import logging
import time
from fastapi import APIRouter, Depends, HTTPException
import pymupdf
from deps import verify_secret, get_pdf_path, save_pdf

router = APIRouter()
log    = logging.getLogger("text_edit")


def _match_font(font_name: str, flags: int) -> str:
    bold  = bool(flags & 16)
    fn    = (font_name or '').lower()
    mono  = bool(flags & 8)  or any(x in fn for x in ('courier', 'cour', 'cobo', 'mono', 'consol', 'typewriter'))
    serif = bool(flags & 4)  or any(x in fn for x in ('times', 'tiro', 'tibo', 'georgia', 'garamond', 'palatino', 'charter', 'minion'))
    if mono:
        return 'cobo' if bold else 'cour'
    if serif:
        return 'tibo' if bold else 'tiro'
    return 'hebo' if bold else 'helv'


def _unpack_color(c) -> list:
    if isinstance(c, (list, tuple)):
        vals = list(c)
        if all(isinstance(v, float) and v <= 1.0 for v in vals):
            return vals[:3]
        return [v / 255.0 for v in vals[:3]]
    return [((c >> 16) & 0xFF) / 255.0, ((c >> 8) & 0xFF) / 255.0, (c & 0xFF) / 255.0]


@router.get("/text-spans/{job_id}/{page_num}")
async def get_text_spans(job_id: str, page_num: int, _=Depends(verify_secret)):
    t0 = time.monotonic()
    log.info("spans  job=%s page=%d", job_id[:8], page_num)
    pdf_path = get_pdf_path(job_id)
    doc = pymupdf.open(str(pdf_path))
    if page_num < 0 or page_num >= len(doc):
        doc.close()
        log.warning("spans  job=%s page=%d → out of range (total=%d)", job_id[:8], page_num, len(doc))
        return {"spans": []}
    page = doc[page_num]
    raw = page.get_text(
        "rawdict",
        flags=pymupdf.TEXT_PRESERVE_WHITESPACE | pymupdf.TEXT_PRESERVE_LIGATURES,
    )
    doc.close()
    spans = []
    for block in raw.get("blocks", []):
        if block.get("type") != 0:
            continue
        for line in block.get("lines", []):
            for span in line.get("spans", []):
                chars = span.get("chars", [])
                text  = "".join(ch.get("c", "") for ch in chars).strip()
                if not text:
                    continue
                bbox   = list(span["bbox"])
                origin = list(span.get("origin", [bbox[0], bbox[3]]))
                color  = _unpack_color(span.get("color", 0))
                spans.append({
                    "text":   text,
                    "bbox":   bbox,
                    "origin": origin,
                    "font":   span.get("font", ""),
                    "size":   span.get("size", 12.0),
                    "flags":  span.get("flags", 0),
                    "color":  color,
                })
    ms = (time.monotonic() - t0) * 1000
    log.info("spans  job=%s page=%d → %d spans  %.0fms", job_id[:8], page_num, len(spans), ms)
    return {"spans": spans}


@router.post("/edit-text/{job_id}")
async def edit_text_span(job_id: str, body: dict, _=Depends(verify_secret)):
    t0 = time.monotonic()

    page_num        = body.get("page")
    bbox            = body.get("bbox")
    origin          = body.get("origin")
    new_text        = (body.get("new_text") or "").strip()
    font            = str(body.get("font", ""))
    size            = float(body.get("size", 12))
    flags           = int(body.get("flags", 0))
    color           = body.get("color", [0.0, 0.0, 0.0])
    resolved_font   = body.get("resolved_font")
    italic_override = body.get("italic")

    action = "edit" if bbox else "insert"
    preview = repr(new_text[:40]) + ("…" if len(new_text) > 40 else "")
    log.info(
        "%s   job=%s page=%s bbox=%s origin=%s font=%s size=%s text=%s",
        action, job_id[:8], page_num,
        [round(v, 1) for v in bbox] if bbox else None,
        [round(v, 1) for v in origin] if origin else None,
        resolved_font or font or "?",
        size, preview,
    )

    if page_num is None or not origin:
        log.error("%s   job=%s → 400 missing page/origin", action, job_id[:8])
        raise HTTPException(400, "page and origin required")

    pdf_path = get_pdf_path(job_id)
    doc = pymupdf.open(str(pdf_path))
    if page_num < 0 or page_num >= len(doc):
        doc.close()
        log.error("%s   job=%s → 400 invalid page %s (total=%d)", action, job_id[:8], page_num, len(doc))
        raise HTTPException(400, "invalid page")

    page = doc[page_num]

    if bbox:
        rect = pymupdf.Rect(bbox)
        bg = (1.0, 1.0, 1.0)
        try:
            cx, cy = (rect.x0 + rect.x1) / 2, (rect.y0 + rect.y1) / 2
            clip = pymupdf.Rect(cx - 1, cy - 1, cx + 1, cy + 1)
            pix  = page.get_pixmap(matrix=pymupdf.Matrix(1, 1), clip=clip, colorspace=pymupdf.csRGB)
            if pix.n >= 3:
                s = pix.samples
                bg = (s[0] / 255.0, s[1] / 255.0, s[2] / 255.0)
        except Exception as exc:
            log.warning("edit   job=%s bg-sample failed: %s", job_id[:8], exc)
        log.info("edit   job=%s redacting bbox=%s bg=%.2f,%.2f,%.2f", job_id[:8],
                 [round(v, 1) for v in bbox], *bg)
        page.add_redact_annot(rect + (-1, -1, 1, 1), fill=bg)
        page.apply_redactions()

    if new_text:
        fontname = resolved_font if resolved_font else _match_font(font, flags)
        col      = tuple(float(v) for v in _unpack_color(color)[:3])
        morph    = None
        use_italic = italic_override if italic_override is not None else bool(flags & 2)
        if use_italic:
            origin_pt = pymupdf.Point(origin[0], origin[1])
            morph = (origin_pt, pymupdf.Matrix(1, 0, 0.2, 1, 0, 0))
        log.info("%s   job=%s inserting font=%s size=%s italic=%s color=%.2f,%.2f,%.2f at (%.1f,%.1f)",
                 action, job_id[:8], fontname, size, use_italic, *col, origin[0], origin[1])
        page.insert_text(
            pymupdf.Point(origin[0], origin[1]),
            new_text,
            fontname=fontname,
            fontsize=size,
            color=col,
            morph=morph,
        )
    elif action == "edit":
        log.info("edit   job=%s text is empty — span deleted (redact only)", job_id[:8])

    save_pdf(doc, job_id)
    ms = (time.monotonic() - t0) * 1000
    log.info("%s   job=%s → ok  %.0fms", action, job_id[:8], ms)
    return {"ok": True}
