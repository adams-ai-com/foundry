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
-- Name: channel_connect_guests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.channel_connect_guests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    email text NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: channel_connect_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.channel_connect_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    guest_id uuid NOT NULL,
    token text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now()
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
-- Name: document_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_id uuid NOT NULL,
    content text NOT NULL,
    resolved boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    resolved_at timestamp with time zone
);


--
-- Name: document_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_id uuid NOT NULL,
    title text NOT NULL,
    content jsonb NOT NULL,
    content_hash text NOT NULL,
    label text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text DEFAULT 'Untitled'::text NOT NULL,
    content jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: change_requests change_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.change_requests
    ADD CONSTRAINT change_requests_pkey PRIMARY KEY (id);


--
-- Name: channel_connect_guests channel_connect_guests_org_id_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_connect_guests
    ADD CONSTRAINT channel_connect_guests_org_id_email_key UNIQUE (org_id, email);


--
-- Name: channel_connect_guests channel_connect_guests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_connect_guests
    ADD CONSTRAINT channel_connect_guests_pkey PRIMARY KEY (id);


--
-- Name: channel_connect_sessions channel_connect_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_connect_sessions
    ADD CONSTRAINT channel_connect_sessions_pkey PRIMARY KEY (id);


--
-- Name: channel_connect_sessions channel_connect_sessions_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_connect_sessions
    ADD CONSTRAINT channel_connect_sessions_token_key UNIQUE (token);


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
-- Name: document_comments document_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_comments
    ADD CONSTRAINT document_comments_pkey PRIMARY KEY (id);


--
-- Name: document_versions document_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_versions
    ADD CONSTRAINT document_versions_pkey PRIMARY KEY (id);


--
-- Name: documents documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_pkey PRIMARY KEY (id);


--
-- Name: document_comments_doc_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_comments_doc_created ON public.document_comments USING btree (document_id, created_at DESC);


--
-- Name: document_versions_doc_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_versions_doc_created ON public.document_versions USING btree (document_id, created_at DESC);


--
-- Name: documents_updated_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX documents_updated_at ON public.documents USING btree (updated_at DESC);


--
-- Name: idx_connect_sessions_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_connect_sessions_token ON public.channel_connect_sessions USING btree (token);


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
-- Name: change_requests change_requests_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER change_requests_updated_at BEFORE UPDATE ON public.change_requests FOR EACH ROW EXECUTE FUNCTION public.set_cr_updated_at();


--
-- Name: channel_connect_sessions channel_connect_sessions_guest_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_connect_sessions
    ADD CONSTRAINT channel_connect_sessions_guest_id_fkey FOREIGN KEY (guest_id) REFERENCES public.channel_connect_guests(id) ON DELETE CASCADE;


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
-- Name: document_comments document_comments_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_comments
    ADD CONSTRAINT document_comments_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;


--
-- Name: document_versions document_versions_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_versions
    ADD CONSTRAINT document_versions_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--


