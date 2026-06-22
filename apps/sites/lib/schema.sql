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
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: folder_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.folder_permissions (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    folder_id text NOT NULL,
    email text NOT NULL,
    role text NOT NULL,
    CONSTRAINT folder_permissions_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'editor'::text, 'viewer'::text, 'none'::text])))
);


--
-- Name: folders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.folders (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    site_id text NOT NULL,
    parent_id text,
    name text DEFAULT 'New folder'::text NOT NULL,
    permission_mode text DEFAULT 'inherit'::text NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT folders_permission_mode_check CHECK ((permission_mode = ANY (ARRAY['inherit'::text, 'override'::text])))
);


--
-- Name: site_files; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.site_files (
    id text NOT NULL,
    site_id text NOT NULL,
    folder_id text,
    name text NOT NULL,
    mime_type text DEFAULT ''::text NOT NULL,
    size integer DEFAULT 0 NOT NULL,
    storage_path text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: site_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.site_members (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    site_id text NOT NULL,
    email text NOT NULL,
    role text NOT NULL,
    added_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT site_members_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'editor'::text, 'viewer'::text])))
);


--
-- Name: site_pages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.site_pages (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    site_id text NOT NULL,
    folder_id text,
    title text DEFAULT ''::text NOT NULL,
    content jsonb DEFAULT '{}'::jsonb NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: sites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sites (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    name text DEFAULT ''::text NOT NULL,
    slug text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: folder_permissions folder_permissions_folder_id_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.folder_permissions
    ADD CONSTRAINT folder_permissions_folder_id_email_key UNIQUE (folder_id, email);


--
-- Name: folder_permissions folder_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.folder_permissions
    ADD CONSTRAINT folder_permissions_pkey PRIMARY KEY (id);


--
-- Name: folders folders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.folders
    ADD CONSTRAINT folders_pkey PRIMARY KEY (id);


--
-- Name: site_files site_files_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_files
    ADD CONSTRAINT site_files_pkey PRIMARY KEY (id);


--
-- Name: site_members site_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_members
    ADD CONSTRAINT site_members_pkey PRIMARY KEY (id);


--
-- Name: site_members site_members_site_id_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_members
    ADD CONSTRAINT site_members_site_id_email_key UNIQUE (site_id, email);


--
-- Name: site_pages site_pages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_pages
    ADD CONSTRAINT site_pages_pkey PRIMARY KEY (id);


--
-- Name: sites sites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sites
    ADD CONSTRAINT sites_pkey PRIMARY KEY (id);


--
-- Name: sites sites_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sites
    ADD CONSTRAINT sites_slug_key UNIQUE (slug);


--
-- Name: folder_permissions folder_permissions_folder_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.folder_permissions
    ADD CONSTRAINT folder_permissions_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES public.folders(id) ON DELETE CASCADE;


--
-- Name: folders folders_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.folders
    ADD CONSTRAINT folders_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.folders(id) ON DELETE CASCADE;


--
-- Name: folders folders_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.folders
    ADD CONSTRAINT folders_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: site_files site_files_folder_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_files
    ADD CONSTRAINT site_files_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES public.folders(id) ON DELETE CASCADE;


--
-- Name: site_files site_files_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_files
    ADD CONSTRAINT site_files_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: site_members site_members_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_members
    ADD CONSTRAINT site_members_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: site_pages site_pages_folder_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_pages
    ADD CONSTRAINT site_pages_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES public.folders(id) ON DELETE CASCADE;


--
-- Name: site_pages site_pages_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_pages
    ADD CONSTRAINT site_pages_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--


