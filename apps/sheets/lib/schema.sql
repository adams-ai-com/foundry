--
-- PostgreSQL database dump
--


-- Dumped from database version 16.14 (Ubuntu 16.14-0ubuntu0.24.04.1)
-- Dumped by pg_dump version 16.14 (Ubuntu 16.14-0ubuntu0.24.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: cr_priority; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.cr_priority AS ENUM (
    'low',
    'medium',
    'high',
    'urgent'
);


--
-- Name: cr_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.cr_status AS ENUM (
    'backlog',
    'up_next',
    'in_progress',
    'in_review',
    'blocked',
    'done'
);


--
-- Name: set_cr_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_cr_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;


--
-- Name: set_spreadsheet_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_spreadsheet_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: change_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.change_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    description text,
    status public.cr_status DEFAULT 'backlog'::public.cr_status NOT NULL,
    priority public.cr_priority DEFAULT 'medium'::public.cr_priority NOT NULL,
    assigned_to text,
    submitted_by text,
    labels text[] DEFAULT '{}'::text[] NOT NULL,
    archived_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: cr_attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cr_attachments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cr_id uuid NOT NULL,
    filename text NOT NULL,
    mime_type text NOT NULL,
    byte_size integer NOT NULL,
    content bytea NOT NULL,
    submitted_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT cr_attachments_byte_size_check CHECK (((byte_size > 0) AND (byte_size <= 11534336))),
    CONSTRAINT cr_attachments_mime_type_check CHECK ((mime_type = ANY (ARRAY['image/png'::text, 'image/jpeg'::text, 'image/gif'::text, 'image/webp'::text, 'application/pdf'::text])))
);


--
-- Name: cr_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cr_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cr_id uuid NOT NULL,
    author text,
    body text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: spreadsheets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.spreadsheets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text DEFAULT 'Untitled'::text NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    formats jsonb,
    charts jsonb DEFAULT '[]'::jsonb,
    merges jsonb DEFAULT '[]'::jsonb NOT NULL
);


--
-- Name: change_requests change_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.change_requests
    ADD CONSTRAINT change_requests_pkey PRIMARY KEY (id);


--
-- Name: cr_attachments cr_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cr_attachments
    ADD CONSTRAINT cr_attachments_pkey PRIMARY KEY (id);


--
-- Name: cr_notes cr_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cr_notes
    ADD CONSTRAINT cr_notes_pkey PRIMARY KEY (id);


--
-- Name: spreadsheets spreadsheets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.spreadsheets
    ADD CONSTRAINT spreadsheets_pkey PRIMARY KEY (id);


--
-- Name: idx_cr_attachments_cr; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cr_attachments_cr ON public.cr_attachments USING btree (cr_id, created_at);


--
-- Name: idx_cr_notes_cr; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cr_notes_cr ON public.cr_notes USING btree (cr_id, created_at);


--
-- Name: idx_cr_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cr_status ON public.change_requests USING btree (status) WHERE (archived_at IS NULL);


--
-- Name: idx_spreadsheets_updated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_spreadsheets_updated ON public.spreadsheets USING btree (updated_at DESC);


--
-- Name: change_requests change_requests_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER change_requests_updated_at BEFORE UPDATE ON public.change_requests FOR EACH ROW EXECUTE FUNCTION public.set_cr_updated_at();


--
-- Name: spreadsheets spreadsheets_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER spreadsheets_updated_at BEFORE UPDATE ON public.spreadsheets FOR EACH ROW EXECUTE FUNCTION public.set_spreadsheet_updated_at();


--
-- Name: cr_attachments cr_attachments_cr_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cr_attachments
    ADD CONSTRAINT cr_attachments_cr_id_fkey FOREIGN KEY (cr_id) REFERENCES public.change_requests(id) ON DELETE CASCADE;


--
-- Name: cr_notes cr_notes_cr_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cr_notes
    ADD CONSTRAINT cr_notes_cr_id_fkey FOREIGN KEY (cr_id) REFERENCES public.change_requests(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--


