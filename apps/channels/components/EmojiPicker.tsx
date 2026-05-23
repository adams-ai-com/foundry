'use client'

interface Props {
  onSelect: (emoji: string) => void
  onClose: () => void
}

const EMOJIS = [
  ['👍', '👎', '❤️', '😂', '😮', '😢', '😡', '🎉'],
  ['🔥', '✅', '👀', '🙌', '🤔', '💯', '🚀', '⭐'],
  ['😄', '😅', '🤣', '😊', '😍', '🥳', '😎', '🤩'],
  ['👏', '🙏', '💪', '🤝', '✌️', '🫡', '💡', '📌'],
]

export function EmojiPicker({ onSelect, onClose }: Props) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute z-50 bottom-full mb-1 bg-bg-raised border border-border rounded-xl shadow-lg p-2">
        {EMOJIS.map((row, i) => (
          <div key={i} className="flex">
            {row.map(emoji => (
              <button
                key={emoji}
                onClick={() => { onSelect(emoji); onClose() }}
                className="w-8 h-8 flex items-center justify-center text-base hover:bg-bg-hover rounded-lg transition-colors"
              >
                {emoji}
              </button>
            ))}
          </div>
        ))}
      </div>
    </>
  )
}
