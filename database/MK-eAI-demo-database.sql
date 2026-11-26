--
-- PostgreSQL database dump
--

-- Dumped from database version 17.0
-- Dumped by pg_dump version 17.0

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: alembic_version; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alembic_version (
    version_num character varying(32) NOT NULL
);


--
-- Name: auth_audit_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auth_audit_events (
    id uuid NOT NULL,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    actor_user_id uuid,
    subject_user_id uuid,
    session_id uuid,
    event_code character varying(64) NOT NULL,
    outcome character varying(16) NOT NULL,
    request_id uuid NOT NULL,
    resource_type character varying(40),
    resource_id uuid,
    details_version smallint DEFAULT '1'::smallint NOT NULL,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT ck_auth_audit_events_details_envelope CHECK (((details_version = 1) AND (jsonb_typeof(details) = 'object'::text) AND (octet_length((details)::text) <= 2048))),
    CONSTRAINT ck_auth_audit_events_event_values CHECK (((event_code)::text = ANY ((ARRAY['auth.bootstrap'::character varying, 'auth.login'::character varying, 'auth.logout'::character varying, 'auth.password_changed'::character varying, 'auth.password_reset'::character varying, 'auth.sessions_revoked'::character varying, 'user.created'::character varying, 'user.updated'::character varying, 'user.locked'::character varying, 'user.unlocked'::character varying, 'user.role_changed'::character varying, 'business.created'::character varying, 'business.updated'::character varying, 'business.replayed'::character varying])::text[]))),
    CONSTRAINT ck_auth_audit_events_outcome_values CHECK (((outcome)::text = ANY ((ARRAY['success'::character varying, 'denied'::character varying, 'failure'::character varying])::text[]))),
    CONSTRAINT ck_auth_audit_events_resource_pair CHECK (((resource_type IS NULL) = (resource_id IS NULL))),
    CONSTRAINT ck_auth_audit_events_resource_types CHECK (((resource_type)::text = ANY ((ARRAY['users'::character varying, 'customer'::character varying, 'snapshot'::character varying, 'prediction_run'::character varying, 'scenario'::character varying])::text[])))
);


--
-- Name: auth_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auth_sessions (
    id uuid NOT NULL,
    user_id uuid,
    state character varying(16) NOT NULL,
    session_token_hash bytea NOT NULL,
    csrf_token character varying(43) NOT NULL,
    security_version bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    idle_expires_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone,
    revoke_reason character varying(32),
    CONSTRAINT ck_auth_sessions_csrf_format CHECK (((csrf_token)::text ~ '^[A-Za-z0-9_-]{43}$'::text)),
    CONSTRAINT ck_auth_sessions_digest_length CHECK ((octet_length(session_token_hash) = 32)),
    CONSTRAINT ck_auth_sessions_identity_state CHECK (((((state)::text = 'preauth'::text) AND (user_id IS NULL) AND (security_version IS NULL)) OR (((state)::text = 'authenticated'::text) AND (user_id IS NOT NULL) AND (security_version IS NOT NULL) AND (security_version >= 1)))),
    CONSTRAINT ck_auth_sessions_revocation_pair CHECK (((revoked_at IS NULL) = (revoke_reason IS NULL))),
    CONSTRAINT ck_auth_sessions_revoke_reason_values CHECK (((revoke_reason)::text = ANY ((ARRAY['LOGOUT'::character varying, 'PASSWORD_CHANGED'::character varying, 'PASSWORD_RESET'::character varying, 'ROLE_CHANGED'::character varying, 'ACCOUNT_DISABLED'::character varying, 'ACCOUNT_UNLOCKED'::character varying, 'ADMIN_REVOKED'::character varying, 'PREAUTH_CONSUMED'::character varying, 'EXPIRED'::character varying])::text[]))),
    CONSTRAINT ck_auth_sessions_revoked_timestamp CHECK (((revoked_at IS NULL) OR (revoked_at >= created_at))),
    CONSTRAINT ck_auth_sessions_state_values CHECK (((state)::text = ANY ((ARRAY['preauth'::character varying, 'authenticated'::character varying])::text[]))),
    CONSTRAINT ck_auth_sessions_timestamps CHECK (((expires_at > created_at) AND (last_seen_at >= created_at) AND (idle_expires_at > created_at) AND (idle_expires_at <= expires_at)))
);


--
-- Name: bulk_analysis_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bulk_analysis_items (
    id uuid NOT NULL,
    job_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    snapshot_id uuid NOT NULL,
    status character varying(16) NOT NULL,
    error_code character varying(80),
    dedupe_key character varying(64),
    prediction_result_id uuid,
    segmentation_result_id uuid,
    CONSTRAINT ck_bulk_analysis_items_analysis_item_status CHECK (((status)::text = ANY ((ARRAY['queued'::character varying, 'success'::character varying, 'skipped'::character varying, 'failed'::character varying])::text[])))
);


--
-- Name: bulk_analysis_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bulk_analysis_jobs (
    id uuid NOT NULL,
    import_job_id uuid NOT NULL,
    actor_user_id uuid NOT NULL,
    plan_key character varying(64) NOT NULL,
    task character varying(20) NOT NULL,
    model_version character varying(80) NOT NULL,
    artifact_sha256 character varying(64) NOT NULL,
    metadata_sha256 character varying(64) NOT NULL,
    persist_results boolean NOT NULL,
    status character varying(16) NOT NULL,
    counts json NOT NULL,
    attempts integer NOT NULL,
    error_code character varying(80),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    CONSTRAINT ck_bulk_analysis_jobs_analysis_status CHECK (((status)::text = ANY ((ARRAY['queued'::character varying, 'running'::character varying, 'completed'::character varying, 'failed'::character varying])::text[]))),
    CONSTRAINT ck_bulk_analysis_jobs_analysis_task CHECK (((task)::text = ANY ((ARRAY['classification'::character varying, 'segmentation'::character varying])::text[])))
);


--
-- Name: bulk_import_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bulk_import_jobs (
    id uuid NOT NULL,
    actor_user_id uuid NOT NULL,
    actor_session_id uuid NOT NULL,
    idempotency_key character varying(36) NOT NULL,
    manifest_digest character varying(64) NOT NULL,
    file_fingerprint character varying(64) NOT NULL,
    status character varying(16) NOT NULL,
    metadata_json json NOT NULL,
    counts json NOT NULL,
    error_code character varying(80),
    error_row integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    CONSTRAINT ck_bulk_import_jobs_bulk_job_status CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'completed'::character varying, 'failed'::character varying])::text[])))
);


--
-- Name: bulk_import_rows; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bulk_import_rows (
    id uuid NOT NULL,
    job_id uuid NOT NULL,
    row_number integer NOT NULL,
    row_key character varying(64),
    snapshot_dedupe_key character varying(64),
    content_hash character varying(64),
    customer_id uuid,
    snapshot_id uuid,
    status character varying(16) NOT NULL,
    outcome json NOT NULL,
    CONSTRAINT ck_bulk_import_rows_bulk_row_number CHECK ((row_number >= 2)),
    CONSTRAINT ck_bulk_import_rows_bulk_row_status CHECK (((status)::text = ANY ((ARRAY['applied'::character varying, 'excluded'::character varying])::text[])))
);


--
-- Name: customer_behavior_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_behavior_snapshots (
    id uuid NOT NULL,
    customer_id uuid NOT NULL,
    captured_at timestamp with time zone DEFAULT now() NOT NULL,
    source character varying(30) DEFAULT 'manual'::character varying NOT NULL,
    age double precision NOT NULL,
    gender character varying(50) NOT NULL,
    country character varying(100) NOT NULL,
    city character varying(150) NOT NULL,
    membership_years double precision NOT NULL,
    login_frequency double precision NOT NULL,
    session_duration_avg double precision NOT NULL,
    pages_per_session double precision NOT NULL,
    cart_abandonment_rate double precision NOT NULL,
    wishlist_items double precision NOT NULL,
    total_purchases double precision NOT NULL,
    average_order_value double precision NOT NULL,
    days_since_last_purchase double precision NOT NULL,
    discount_usage_rate double precision NOT NULL,
    returns_rate double precision NOT NULL,
    email_open_rate double precision NOT NULL,
    customer_service_calls double precision NOT NULL,
    product_reviews_written double precision NOT NULL,
    social_media_engagement_score double precision NOT NULL,
    mobile_app_usage double precision NOT NULL,
    payment_method_diversity double precision NOT NULL,
    lifetime_value double precision NOT NULL,
    credit_balance double precision NOT NULL,
    churned boolean NOT NULL,
    signup_quarter character varying(2) NOT NULL,
    CONSTRAINT ck_customer_behavior_snapshots_age_range CHECK (((age >= (0)::double precision) AND (age <= (120)::double precision))),
    CONSTRAINT ck_customer_behavior_snapshots_commerce_values_nonnegative CHECK (((wishlist_items >= (0)::double precision) AND (total_purchases >= (0)::double precision) AND (average_order_value >= (0)::double precision))),
    CONSTRAINT ck_customer_behavior_snapshots_counts_nonnegative CHECK (((days_since_last_purchase >= (0)::double precision) AND (customer_service_calls >= (0)::double precision) AND (product_reviews_written >= (0)::double precision))),
    CONSTRAINT ck_customer_behavior_snapshots_engagement_nonnegative CHECK (((login_frequency >= (0)::double precision) AND (session_duration_avg >= (0)::double precision) AND (pages_per_session >= (0)::double precision))),
    CONSTRAINT ck_customer_behavior_snapshots_financial_values_nonnegative CHECK (((lifetime_value >= (0)::double precision) AND (credit_balance >= (0)::double precision))),
    CONSTRAINT ck_customer_behavior_snapshots_membership_years_nonnegative CHECK ((membership_years >= (0)::double precision)),
    CONSTRAINT ck_customer_behavior_snapshots_rates_percentage_range CHECK ((((cart_abandonment_rate >= (0)::double precision) AND (cart_abandonment_rate <= (100)::double precision)) AND ((discount_usage_rate >= (0)::double precision) AND (discount_usage_rate <= (100)::double precision)) AND ((returns_rate >= (0)::double precision) AND (returns_rate <= (100)::double precision)) AND ((email_open_rate >= (0)::double precision) AND (email_open_rate <= (100)::double precision)))),
    CONSTRAINT ck_customer_behavior_snapshots_signup_quarter_values CHECK (((signup_quarter)::text = ANY ((ARRAY['Q1'::character varying, 'Q2'::character varying, 'Q3'::character varying, 'Q4'::character varying])::text[])))
);


--
-- Name: customer_source_identities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_source_identities (
    id uuid NOT NULL,
    source_system character varying(30) NOT NULL,
    external_customer_id character varying(100) NOT NULL,
    customer_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customers (
    id uuid NOT NULL,
    external_id character varying(100) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deactivated_at timestamp with time zone
);


--
-- Name: ml_models; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ml_models (
    id uuid NOT NULL,
    name character varying(150) NOT NULL,
    task character varying(30) NOT NULL,
    algorithm character varying(100) NOT NULL,
    version character varying(50) NOT NULL,
    artifact_path character varying(500) NOT NULL,
    metadata_path character varying(500) NOT NULL,
    artifact_checksum character varying(64),
    metadata_json jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_ml_models_task_values CHECK (((task)::text = ANY ((ARRAY['classification'::character varying, 'segmentation'::character varying, 'what_if'::character varying])::text[])))
);


--
-- Name: prediction_results; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.prediction_results (
    id uuid NOT NULL,
    run_id uuid NOT NULL,
    model_id uuid NOT NULL,
    customer_id uuid,
    behavior_snapshot_id uuid,
    input_features jsonb NOT NULL,
    predicted_class smallint NOT NULL,
    purchase_level character varying(10) NOT NULL,
    probability_low double precision NOT NULL,
    probability_medium double precision NOT NULL,
    probability_high double precision NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_prediction_results_predicted_class_range CHECK (((predicted_class >= 0) AND (predicted_class <= 2))),
    CONSTRAINT ck_prediction_results_probabilities_range CHECK ((((probability_low >= (0)::double precision) AND (probability_low <= (1)::double precision)) AND ((probability_medium >= (0)::double precision) AND (probability_medium <= (1)::double precision)) AND ((probability_high >= (0)::double precision) AND (probability_high <= (1)::double precision)))),
    CONSTRAINT ck_prediction_results_purchase_level_values CHECK (((purchase_level)::text = ANY ((ARRAY['Low'::character varying, 'Medium'::character varying, 'High'::character varying])::text[])))
);


--
-- Name: prediction_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.prediction_runs (
    id uuid NOT NULL,
    model_id uuid NOT NULL,
    task character varying(30) NOT NULL,
    run_type character varying(20) NOT NULL,
    source character varying(50) DEFAULT 'api'::character varying NOT NULL,
    status character varying(20) DEFAULT 'completed'::character varying NOT NULL,
    requested_count integer NOT NULL,
    success_count integer NOT NULL,
    failure_count integer DEFAULT 0 NOT NULL,
    persist_results boolean DEFAULT true NOT NULL,
    error_message character varying(1000),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone DEFAULT now(),
    CONSTRAINT ck_prediction_runs_run_counts_nonnegative CHECK (((requested_count >= 0) AND (success_count >= 0) AND (failure_count >= 0))),
    CONSTRAINT ck_prediction_runs_run_status_values CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'completed'::character varying, 'failed'::character varying])::text[]))),
    CONSTRAINT ck_prediction_runs_run_task_values CHECK (((task)::text = ANY ((ARRAY['classification'::character varying, 'segmentation'::character varying])::text[]))),
    CONSTRAINT ck_prediction_runs_run_type_values CHECK (((run_type)::text = ANY ((ARRAY['single'::character varying, 'batch'::character varying, 'csv'::character varying, 'scenario'::character varying])::text[])))
);


--
-- Name: prediction_scenarios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.prediction_scenarios (
    id uuid NOT NULL,
    customer_id uuid,
    baseline_snapshot_id uuid,
    name character varying(200) NOT NULL,
    description text,
    changed_features jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: scenario_results; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scenario_results (
    id uuid NOT NULL,
    scenario_id uuid NOT NULL,
    model_id uuid NOT NULL,
    baseline_prediction_result_id uuid,
    before_result jsonb NOT NULL,
    after_result jsonb NOT NULL,
    probability_deltas jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: segmentation_results; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.segmentation_results (
    id uuid NOT NULL,
    run_id uuid NOT NULL,
    model_id uuid NOT NULL,
    customer_id uuid,
    behavior_snapshot_id uuid,
    input_features jsonb NOT NULL,
    cluster integer NOT NULL,
    segment_name character varying(150) NOT NULL,
    distance_to_centroid double precision NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_segmentation_results_cluster_nonnegative CHECK ((cluster >= 0)),
    CONSTRAINT ck_segmentation_results_distance_nonnegative CHECK ((distance_to_centroid >= (0)::double precision))
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid NOT NULL,
    username character varying(64) NOT NULL,
    display_name character varying(100) NOT NULL,
    password_hash character varying(512) NOT NULL,
    role character varying(16) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    must_change_password boolean DEFAULT true NOT NULL,
    security_version bigint DEFAULT '1'::bigint NOT NULL,
    row_version bigint DEFAULT '1'::bigint NOT NULL,
    failed_attempts integer DEFAULT 0 NOT NULL,
    failure_window_started_at timestamp with time zone,
    locked_until timestamp with time zone,
    last_login_at timestamp with time zone,
    password_changed_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by_user_id uuid,
    updated_by_user_id uuid,
    CONSTRAINT ck_users_display_name_length CHECK (((char_length((display_name)::text) >= 1) AND (char_length((display_name)::text) <= 100))),
    CONSTRAINT ck_users_failure_window CHECK (((failed_attempts = 0) = (failure_window_started_at IS NULL))),
    CONSTRAINT ck_users_failures_range CHECK (((failed_attempts >= 0) AND (failed_attempts <= 5))),
    CONSTRAINT ck_users_lock_consistency CHECK (((locked_until IS NULL) OR ((failed_attempts = 5) AND (failure_window_started_at IS NOT NULL)))),
    CONSTRAINT ck_users_role_values CHECK (((role)::text = ANY ((ARRAY['ADMIN'::character varying, 'OPERATOR'::character varying, 'VIEWER'::character varying])::text[]))),
    CONSTRAINT ck_users_timestamps CHECK ((updated_at >= created_at)),
    CONSTRAINT ck_users_username_canonical CHECK (((username)::text ~ '^[a-z0-9][a-z0-9._-]{2,63}$'::text)),
    CONSTRAINT ck_users_versions_positive CHECK (((security_version >= 1) AND (row_version >= 1)))
);


--
-- Data for Name: alembic_version; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.alembic_version (version_num) FROM stdin;
f10b20261105
\.


--
-- Data for Name: bulk_analysis_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.bulk_analysis_items (id, job_id, customer_id, snapshot_id, status, error_code, dedupe_key, prediction_result_id, segmentation_result_id) FROM stdin;
0abb9f05-a4d7-4088-8767-279f31c07576	8d472a98-de02-4787-8031-307dfcf2c5f7	e7cab491-86a0-487f-b40e-5e5b6d6b2c5d	efdea114-ea80-4b5c-94d2-0590544d3ea0	success	\N	5f662b2cd68358465089f256a5eab29eec5fa0b01a26bf3264ac02a0b0659a58	5a04cc42-b1be-4dc8-bb39-63ad85c1d615	\N
210194c4-0660-43ce-a6cc-ab74853d3c03	8d472a98-de02-4787-8031-307dfcf2c5f7	5296c492-d639-49b2-b079-ffd975e6fede	fcbf66a3-0563-4767-a279-3b75f0ae4a3e	success	\N	ef97ad064568a58bac8a4d09bde3ce1f49a894ccb37997c36533785cd1b2fe80	0960597a-64f8-4b6b-b28c-eb6dc5b12e9e	\N
26c2bd66-bb45-4224-aa88-b8f2e667025d	8d472a98-de02-4787-8031-307dfcf2c5f7	2f53e95b-d728-4eb3-a08e-a0b9525c3ca2	659f1dda-79b9-4971-9f4c-ffe36f9acb38	success	\N	b08c7ef5e6ae91fefc763d2939f512c07ff4a6d26d7524aa248f65d1c288cbe8	26ffc057-dd44-420b-973a-1d1fb9bcb817	\N
51d9f78d-7702-48b8-95db-ad8351b67b89	8d472a98-de02-4787-8031-307dfcf2c5f7	160f6589-9281-4c66-9e34-5e34d959e368	aceae448-736d-4822-a224-149441d67c08	success	\N	4df215839745d01d9c5109ac7ae8aae44308220e95dad2efc7f94584c5d05c42	c4f37441-9859-4a42-b164-b9c170834e66	\N
57086e19-54ca-4448-9919-6f39e7cb249b	8d472a98-de02-4787-8031-307dfcf2c5f7	57f69d5a-454f-44dc-87e6-ceed37752554	4be8ac8a-8a3f-4fd6-9bf8-d0e212ea68e3	success	\N	4ab732dab9706b902453fbfb682010bd1cbf2feeddfcad108deaee827634bf45	93252cef-6c5b-47e6-928f-affac50a73e6	\N
67bf4bb7-dba1-4675-aa36-566d45bfa8e2	8d472a98-de02-4787-8031-307dfcf2c5f7	4efac273-318c-4742-b381-e07a7d4d63d0	ee6ad2c4-a96e-4ea9-afb5-bb039b1c2629	success	\N	96b54a6744ee14331b4123bfde2a3a3db7f7d197115808d7dd0525d0e5ceacfe	79b1ff67-8d72-4e60-9fbb-9efdf3bdb2db	\N
b001ffff-2259-4bea-9468-efda0817c0e7	8d472a98-de02-4787-8031-307dfcf2c5f7	163739c8-fa6b-4787-9998-ee64f036abb0	41983682-1ec7-4897-a67e-54c50942bf28	success	\N	f6f13fbb7315c591a5d56f6d3d29cdf8cc1877500a1fec31d87ec204db949532	ea36b97d-0b35-4c8a-832a-269bf45c6269	\N
e018fe9f-536c-45ed-816b-a3473786d78c	8d472a98-de02-4787-8031-307dfcf2c5f7	e1152b08-1d0a-42b5-b820-542c6a1be3bb	8132853b-d363-452e-802b-c33606f6c154	success	\N	c3673bad09c1f447aa18c221ad1fd284ae0dbf440380c2afa5b1d49c6f10c668	79cf2c0c-f5f3-4652-b157-511ccf5dab66	\N
f4f6e449-6e57-4e0f-9adb-07340653925e	8d472a98-de02-4787-8031-307dfcf2c5f7	dd4e4b7a-6abc-4f13-9248-5a97d610173d	c856127a-ada0-4519-8f49-0e0698fa3111	success	\N	66b7ab78bcd7fb066cc1cb766766880ccbe61e2727dc4acf4ce3c7b41e5298c9	1f80187f-bcff-4a29-b13d-31a84c37b230	\N
f9c22f55-81e5-4db5-a0ec-d8c4c19dd2f7	8d472a98-de02-4787-8031-307dfcf2c5f7	8162c657-ebf3-47d3-82c4-311a988bfb5c	d29947f1-3535-4d4f-9c3d-18497bc688b0	success	\N	d966ca3d82a746ad1a371ce5e270221bce31233fe608cfc5d0b32a508089cc77	966e22e5-70bc-4f5d-8dc6-9ddb139893ec	\N
261a8930-d4c4-4b9b-ae5e-9a3b777b9058	51b206a9-f0b7-44d5-af62-5352ed488f79	dd4e4b7a-6abc-4f13-9248-5a97d610173d	c856127a-ada0-4519-8f49-0e0698fa3111	success	\N	c98bbed3ec32288fdcbe55776d809a955bc230f17529eb6a154b29df7a7e1696	\N	bf30d12b-1fff-46a3-9a78-c41a631ee527
402a0ee2-4f43-4330-af03-ef838871214f	51b206a9-f0b7-44d5-af62-5352ed488f79	160f6589-9281-4c66-9e34-5e34d959e368	aceae448-736d-4822-a224-149441d67c08	success	\N	a1f6fc3637c16f11bae51052402a13bccc5dfef94432d1e11f047314f8c0efaf	\N	28a57a6b-24dd-4549-a666-c972afac4075
6a2cc0fe-9885-40bb-a532-970ab2a9ae14	51b206a9-f0b7-44d5-af62-5352ed488f79	8162c657-ebf3-47d3-82c4-311a988bfb5c	d29947f1-3535-4d4f-9c3d-18497bc688b0	success	\N	db2f8152c276b28dfda05517e4451fd79bc5b0a872b2af14edc24f43b1d7fe90	\N	a601b775-7d0a-4083-bdf4-576e4f91a4ab
8317766d-49be-4164-aa7c-3c36115dd063	51b206a9-f0b7-44d5-af62-5352ed488f79	2f53e95b-d728-4eb3-a08e-a0b9525c3ca2	659f1dda-79b9-4971-9f4c-ffe36f9acb38	success	\N	f1ef835c660d038717681ecdba8bb815150e73b0f43a0d42d35e294358e8e768	\N	f710eed9-3d55-4d66-9170-f6a999e9791a
87070d65-e54d-41f4-a7ef-7b49f94ee6da	51b206a9-f0b7-44d5-af62-5352ed488f79	5296c492-d639-49b2-b079-ffd975e6fede	fcbf66a3-0563-4767-a279-3b75f0ae4a3e	success	\N	87c50b1ae90f500f472468f4723b92b140c47149a0385b6e2779e85b2db30480	\N	dcb8bbc6-6adf-42a8-8f78-4607dc11c101
8db992d7-d2c6-4c2b-9369-9c1e8523fb59	51b206a9-f0b7-44d5-af62-5352ed488f79	4efac273-318c-4742-b381-e07a7d4d63d0	ee6ad2c4-a96e-4ea9-afb5-bb039b1c2629	success	\N	735e0c236045b89f041bd45efeba056eac336b162a3d0fcd913e275da719d4dc	\N	a17bf06d-6c98-4f2e-8dca-95e65626d696
9e3ac735-7334-4a77-8cce-25e0d536483f	51b206a9-f0b7-44d5-af62-5352ed488f79	57f69d5a-454f-44dc-87e6-ceed37752554	4be8ac8a-8a3f-4fd6-9bf8-d0e212ea68e3	success	\N	f13bd7502458813497e08ec2d835b0986741829a878c3c51c2718ec70141f432	\N	020861fb-913c-45d0-9b80-0473abf7ce3c
b4109bbb-5e82-443f-9415-2808ace583bd	51b206a9-f0b7-44d5-af62-5352ed488f79	e1152b08-1d0a-42b5-b820-542c6a1be3bb	8132853b-d363-452e-802b-c33606f6c154	success	\N	0a74a1e570cde6709d418d782659e486c704983f5e8d9086cae0bb52ccb9d211	\N	0f957ebb-7a84-4794-ad5c-959c9a9fc3a9
c29ee5fc-08a8-4aff-91ce-653ba715049f	51b206a9-f0b7-44d5-af62-5352ed488f79	e7cab491-86a0-487f-b40e-5e5b6d6b2c5d	efdea114-ea80-4b5c-94d2-0590544d3ea0	success	\N	01b260d9ca6d9e2fc35f3096d7060a4d60315cd624cb2ccf6a0464729d8fe3e5	\N	aeb25456-70cd-4cd2-a96a-f4aad9a1e3af
c6435d45-7f01-4e40-bb80-a42b4b851c1f	51b206a9-f0b7-44d5-af62-5352ed488f79	163739c8-fa6b-4787-9998-ee64f036abb0	41983682-1ec7-4897-a67e-54c50942bf28	success	\N	2999b8226badab631c4082de50e3f4c4020fc9e2760f9037e815f9a5fc627307	\N	9b5f6af8-6b49-4456-a265-1bee2595a455
186f4702-437a-42d7-82a3-aac66ff112bc	8e15ba52-267c-47d6-86b9-44ea3a0d2e07	2f53e95b-d728-4eb3-a08e-a0b9525c3ca2	659f1dda-79b9-4971-9f4c-ffe36f9acb38	success	\N	\N	\N	\N
27b7773c-7172-440d-9459-caf1fe2377fc	8e15ba52-267c-47d6-86b9-44ea3a0d2e07	5296c492-d639-49b2-b079-ffd975e6fede	fcbf66a3-0563-4767-a279-3b75f0ae4a3e	success	\N	\N	\N	\N
61ef1a3f-371a-481d-a5bc-1980fe6244e0	8e15ba52-267c-47d6-86b9-44ea3a0d2e07	160f6589-9281-4c66-9e34-5e34d959e368	aceae448-736d-4822-a224-149441d67c08	success	\N	\N	\N	\N
65cd0c33-1d63-4926-9c44-f98c17b797af	8e15ba52-267c-47d6-86b9-44ea3a0d2e07	8162c657-ebf3-47d3-82c4-311a988bfb5c	d29947f1-3535-4d4f-9c3d-18497bc688b0	success	\N	\N	\N	\N
790eb1b6-6486-418f-8a91-8b8e98729de9	8e15ba52-267c-47d6-86b9-44ea3a0d2e07	dd4e4b7a-6abc-4f13-9248-5a97d610173d	c856127a-ada0-4519-8f49-0e0698fa3111	success	\N	\N	\N	\N
81383952-5ae1-4955-9901-4ce4d2a2bf18	8e15ba52-267c-47d6-86b9-44ea3a0d2e07	163739c8-fa6b-4787-9998-ee64f036abb0	41983682-1ec7-4897-a67e-54c50942bf28	success	\N	\N	\N	\N
83c2cb65-f041-40bb-bcca-2cdfb0b7e331	8e15ba52-267c-47d6-86b9-44ea3a0d2e07	4efac273-318c-4742-b381-e07a7d4d63d0	ee6ad2c4-a96e-4ea9-afb5-bb039b1c2629	success	\N	\N	\N	\N
85eb3ef0-4699-4fc3-959e-0aea690765f3	8e15ba52-267c-47d6-86b9-44ea3a0d2e07	57f69d5a-454f-44dc-87e6-ceed37752554	4be8ac8a-8a3f-4fd6-9bf8-d0e212ea68e3	success	\N	\N	\N	\N
e30b3a05-c9c1-4ebf-873c-459b220782a2	8e15ba52-267c-47d6-86b9-44ea3a0d2e07	e7cab491-86a0-487f-b40e-5e5b6d6b2c5d	efdea114-ea80-4b5c-94d2-0590544d3ea0	success	\N	\N	\N	\N
e4497ad4-d933-4a5c-8570-1a1d6ea428e4	8e15ba52-267c-47d6-86b9-44ea3a0d2e07	e1152b08-1d0a-42b5-b820-542c6a1be3bb	8132853b-d363-452e-802b-c33606f6c154	success	\N	\N	\N	\N
123ccd13-252c-42a0-a2ff-cf3939274237	624be4b5-2613-42ba-b5e2-d0a042d037f6	5296c492-d639-49b2-b079-ffd975e6fede	fcbf66a3-0563-4767-a279-3b75f0ae4a3e	success	\N	\N	\N	\N
3a1bb5f9-56a7-4081-9424-c3e76a85ff4c	624be4b5-2613-42ba-b5e2-d0a042d037f6	57f69d5a-454f-44dc-87e6-ceed37752554	4be8ac8a-8a3f-4fd6-9bf8-d0e212ea68e3	success	\N	\N	\N	\N
52f27583-0f1c-4d73-9dfc-28bdea45ca39	624be4b5-2613-42ba-b5e2-d0a042d037f6	e1152b08-1d0a-42b5-b820-542c6a1be3bb	8132853b-d363-452e-802b-c33606f6c154	success	\N	\N	\N	\N
5fd970b4-d826-4c1c-adda-3803a1ce73fc	624be4b5-2613-42ba-b5e2-d0a042d037f6	e7cab491-86a0-487f-b40e-5e5b6d6b2c5d	efdea114-ea80-4b5c-94d2-0590544d3ea0	success	\N	\N	\N	\N
a463e720-20d4-4458-a9f5-19f220561715	624be4b5-2613-42ba-b5e2-d0a042d037f6	8162c657-ebf3-47d3-82c4-311a988bfb5c	d29947f1-3535-4d4f-9c3d-18497bc688b0	success	\N	\N	\N	\N
be118773-f578-4413-97dd-938209dedf92	624be4b5-2613-42ba-b5e2-d0a042d037f6	dd4e4b7a-6abc-4f13-9248-5a97d610173d	c856127a-ada0-4519-8f49-0e0698fa3111	success	\N	\N	\N	\N
bea20e2b-83a7-42dd-88d2-9420e04d737a	624be4b5-2613-42ba-b5e2-d0a042d037f6	2f53e95b-d728-4eb3-a08e-a0b9525c3ca2	659f1dda-79b9-4971-9f4c-ffe36f9acb38	success	\N	\N	\N	\N
daf59228-21f8-42ed-bb58-16d663d8699b	624be4b5-2613-42ba-b5e2-d0a042d037f6	4efac273-318c-4742-b381-e07a7d4d63d0	ee6ad2c4-a96e-4ea9-afb5-bb039b1c2629	success	\N	\N	\N	\N
e08902a7-3fd2-4aac-8c5c-298e381d5db8	624be4b5-2613-42ba-b5e2-d0a042d037f6	163739c8-fa6b-4787-9998-ee64f036abb0	41983682-1ec7-4897-a67e-54c50942bf28	success	\N	\N	\N	\N
fbf8248c-2e7d-44f9-9346-8a68c790d20f	624be4b5-2613-42ba-b5e2-d0a042d037f6	160f6589-9281-4c66-9e34-5e34d959e368	aceae448-736d-4822-a224-149441d67c08	success	\N	\N	\N	\N
1436763e-67d2-4d64-a467-d9384f1c19c2	0d882cd9-4b46-4c09-a286-6b389da8efdd	163739c8-fa6b-4787-9998-ee64f036abb0	41983682-1ec7-4897-a67e-54c50942bf28	success	\N	\N	\N	\N
281d0caf-22d6-471b-aef0-3c1b05258c6a	0d882cd9-4b46-4c09-a286-6b389da8efdd	e1152b08-1d0a-42b5-b820-542c6a1be3bb	8132853b-d363-452e-802b-c33606f6c154	success	\N	\N	\N	\N
6d52d5f0-4aed-4e49-8047-22d11f9084e9	0d882cd9-4b46-4c09-a286-6b389da8efdd	2f53e95b-d728-4eb3-a08e-a0b9525c3ca2	659f1dda-79b9-4971-9f4c-ffe36f9acb38	success	\N	\N	\N	\N
89bb43d2-078b-4b4e-b854-c2db95569e42	0d882cd9-4b46-4c09-a286-6b389da8efdd	4efac273-318c-4742-b381-e07a7d4d63d0	ee6ad2c4-a96e-4ea9-afb5-bb039b1c2629	success	\N	\N	\N	\N
9eaa9c02-9d94-43ac-a856-839c4ff75f5c	0d882cd9-4b46-4c09-a286-6b389da8efdd	160f6589-9281-4c66-9e34-5e34d959e368	aceae448-736d-4822-a224-149441d67c08	success	\N	\N	\N	\N
a700e1ad-e742-424e-a8f1-28b5c692de7e	0d882cd9-4b46-4c09-a286-6b389da8efdd	8162c657-ebf3-47d3-82c4-311a988bfb5c	d29947f1-3535-4d4f-9c3d-18497bc688b0	success	\N	\N	\N	\N
aedd6cdb-7cc8-4fd4-ad4e-778de323c310	0d882cd9-4b46-4c09-a286-6b389da8efdd	dd4e4b7a-6abc-4f13-9248-5a97d610173d	c856127a-ada0-4519-8f49-0e0698fa3111	success	\N	\N	\N	\N
ced6a957-e056-4b1b-a047-d32f0d80732a	0d882cd9-4b46-4c09-a286-6b389da8efdd	57f69d5a-454f-44dc-87e6-ceed37752554	4be8ac8a-8a3f-4fd6-9bf8-d0e212ea68e3	success	\N	\N	\N	\N
7b256690-f814-4089-b08b-10be8f7c56de	0d882cd9-4b46-4c09-a286-6b389da8efdd	5296c492-d639-49b2-b079-ffd975e6fede	fcbf66a3-0563-4767-a279-3b75f0ae4a3e	success	\N	\N	\N	\N
e9c86e61-edb8-4f87-931c-bd97396bc942	0d882cd9-4b46-4c09-a286-6b389da8efdd	e7cab491-86a0-487f-b40e-5e5b6d6b2c5d	efdea114-ea80-4b5c-94d2-0590544d3ea0	success	\N	\N	\N	\N
18c1311d-186f-429f-b44f-8022fbf31e87	7ca4e8e4-bce1-4c5b-b24a-18fef5f23308	2f53e95b-d728-4eb3-a08e-a0b9525c3ca2	659f1dda-79b9-4971-9f4c-ffe36f9acb38	success	\N	\N	\N	\N
2950450a-bbea-4fe7-a5da-93ac539dffad	7ca4e8e4-bce1-4c5b-b24a-18fef5f23308	4efac273-318c-4742-b381-e07a7d4d63d0	ee6ad2c4-a96e-4ea9-afb5-bb039b1c2629	success	\N	\N	\N	\N
2b62a8a7-9b72-48ca-97e0-94a9353c0987	7ca4e8e4-bce1-4c5b-b24a-18fef5f23308	8162c657-ebf3-47d3-82c4-311a988bfb5c	d29947f1-3535-4d4f-9c3d-18497bc688b0	success	\N	\N	\N	\N
4f563711-5977-4433-b1e3-485aa9a04463	7ca4e8e4-bce1-4c5b-b24a-18fef5f23308	160f6589-9281-4c66-9e34-5e34d959e368	aceae448-736d-4822-a224-149441d67c08	success	\N	\N	\N	\N
51beac2d-0f31-409f-a40c-b3ca3f1345da	7ca4e8e4-bce1-4c5b-b24a-18fef5f23308	e1152b08-1d0a-42b5-b820-542c6a1be3bb	8132853b-d363-452e-802b-c33606f6c154	success	\N	\N	\N	\N
53531f19-7bc3-4403-9dea-f9f35be30d63	7ca4e8e4-bce1-4c5b-b24a-18fef5f23308	e7cab491-86a0-487f-b40e-5e5b6d6b2c5d	efdea114-ea80-4b5c-94d2-0590544d3ea0	success	\N	\N	\N	\N
6d31e6de-4ce5-4bc3-bd8c-e12c378e56fb	7ca4e8e4-bce1-4c5b-b24a-18fef5f23308	57f69d5a-454f-44dc-87e6-ceed37752554	4be8ac8a-8a3f-4fd6-9bf8-d0e212ea68e3	success	\N	\N	\N	\N
805a4a41-2c81-4ff2-b01b-7fc48f8a021c	7ca4e8e4-bce1-4c5b-b24a-18fef5f23308	5296c492-d639-49b2-b079-ffd975e6fede	fcbf66a3-0563-4767-a279-3b75f0ae4a3e	success	\N	\N	\N	\N
cc170815-3e6f-403a-9aa5-c799f689433a	7ca4e8e4-bce1-4c5b-b24a-18fef5f23308	163739c8-fa6b-4787-9998-ee64f036abb0	41983682-1ec7-4897-a67e-54c50942bf28	success	\N	\N	\N	\N
f942fd25-f052-44a7-bacc-81514745d03a	7ca4e8e4-bce1-4c5b-b24a-18fef5f23308	dd4e4b7a-6abc-4f13-9248-5a97d610173d	c856127a-ada0-4519-8f49-0e0698fa3111	success	\N	\N	\N	\N
72e458a1-fc86-4da9-b07d-eb9a27a7eaad	bca817b2-db34-41bb-adaa-237e58cebd28	ca7c6bc9-5e44-424f-8fe2-75c5b00201a0	a06ed6d7-559b-4f15-ba70-719f1a96648d	success	\N	f0b61014b96959fc5a7c11dcff8aaf25a514f10d14177f43e43bd230d91978d9	92efd31c-19cd-4464-9c3a-e933a471e23a	\N
7cbe8d51-a7b7-4bdf-9974-d8938c2439be	bca817b2-db34-41bb-adaa-237e58cebd28	31c63922-7346-414c-8346-deae09984763	71a3fc19-abba-49d9-a693-c3acaed40168	success	\N	34aef37b9ac84641adeaa03959fba0442804f7bd7cdcc4ffa44ee7faf9e0bd3a	37c813a7-0985-4bc2-887f-7383fd844347	\N
8abbb500-3a66-44b7-b581-a890c227bdc7	bca817b2-db34-41bb-adaa-237e58cebd28	0a9ab69a-3e34-41bd-91bd-2ff1a9611e13	32464d68-d517-4fda-9cdb-e04204f8efe9	success	\N	47255c75f3bb50c10c4610355a46d19147f89ba37883492296a31486691a83f6	5449871f-b5c1-4e28-b17f-cf85d4e4f528	\N
adf750d3-6402-47d8-838e-f6f5dcf40def	bca817b2-db34-41bb-adaa-237e58cebd28	727ec9c1-79ad-4c07-acfe-8daf9690fb2c	3ea17821-fe0c-467b-8ee4-d8a1716c8db4	success	\N	f08ee5fc692e389a5ea05f34049b3cec9e4d5b3567a9bd93d020ca3e81f0bee2	dc08e570-44d7-4373-843b-0cd690c80bef	\N
051448e2-e862-4bdc-9bc9-8d633d414879	527831fc-e34c-4096-80b8-e8a0fc42d5b6	727ec9c1-79ad-4c07-acfe-8daf9690fb2c	3ea17821-fe0c-467b-8ee4-d8a1716c8db4	success	\N	bd7ca6e294d373297b55c345b45a6943e88d429443065a228d4912c22e4ae99b	\N	50b8625c-8a21-49b9-a138-9ba5275a88ed
0d668374-0deb-4bda-b424-2489cbbf58a0	527831fc-e34c-4096-80b8-e8a0fc42d5b6	0a9ab69a-3e34-41bd-91bd-2ff1a9611e13	32464d68-d517-4fda-9cdb-e04204f8efe9	success	\N	40948a6698c10d1869a5ce67561f500cce6537d4a471a978fcabbc7b54933b0f	\N	a014fdc2-6652-4add-8a8c-ee98505b6d77
e1470929-f3b2-4a3b-a3fe-1afd0d686fb5	527831fc-e34c-4096-80b8-e8a0fc42d5b6	31c63922-7346-414c-8346-deae09984763	71a3fc19-abba-49d9-a693-c3acaed40168	success	\N	b061c9cebfbb0fa9e7d161f7833946db81c2fb6ec7ee71af1f57899d64ebc24c	\N	608836e9-2434-4891-bb7b-a925cdff4ee6
fa286244-d399-4a25-ad88-8ed7fa70e4b6	527831fc-e34c-4096-80b8-e8a0fc42d5b6	ca7c6bc9-5e44-424f-8fe2-75c5b00201a0	a06ed6d7-559b-4f15-ba70-719f1a96648d	success	\N	15a6bc097f09511ec0b4e1c9e9cebe5f82e5a4225110c55c3842933b24878d73	\N	9c9dbb3f-890d-4f78-b7c4-6fe72bc0c863
6b0737c3-7067-4fda-a5dd-f90871aade14	27182fd3-a89b-41c9-b9aa-fa86babe73ae	0a9ab69a-3e34-41bd-91bd-2ff1a9611e13	32464d68-d517-4fda-9cdb-e04204f8efe9	success	\N	\N	5449871f-b5c1-4e28-b17f-cf85d4e4f528	\N
8cb9e352-bb04-41f7-b2c6-3d30608076cc	27182fd3-a89b-41c9-b9aa-fa86babe73ae	ca7c6bc9-5e44-424f-8fe2-75c5b00201a0	a06ed6d7-559b-4f15-ba70-719f1a96648d	success	\N	\N	92efd31c-19cd-4464-9c3a-e933a471e23a	\N
cd2de866-b530-4e60-a1a5-dc749c1b47b1	27182fd3-a89b-41c9-b9aa-fa86babe73ae	727ec9c1-79ad-4c07-acfe-8daf9690fb2c	3ea17821-fe0c-467b-8ee4-d8a1716c8db4	success	\N	\N	dc08e570-44d7-4373-843b-0cd690c80bef	\N
4bd07998-28ff-42a1-a50b-b556731262d5	8de7a3d5-09fc-4cfc-b829-5374c31c039a	0a9ab69a-3e34-41bd-91bd-2ff1a9611e13	32464d68-d517-4fda-9cdb-e04204f8efe9	success	\N	\N	\N	a014fdc2-6652-4add-8a8c-ee98505b6d77
abce2855-37ff-4f6f-9659-26577e1fb20a	8de7a3d5-09fc-4cfc-b829-5374c31c039a	727ec9c1-79ad-4c07-acfe-8daf9690fb2c	3ea17821-fe0c-467b-8ee4-d8a1716c8db4	success	\N	\N	\N	50b8625c-8a21-49b9-a138-9ba5275a88ed
baca2caa-d6be-49fb-b235-12f73185711f	8de7a3d5-09fc-4cfc-b829-5374c31c039a	ca7c6bc9-5e44-424f-8fe2-75c5b00201a0	a06ed6d7-559b-4f15-ba70-719f1a96648d	success	\N	\N	\N	9c9dbb3f-890d-4f78-b7c4-6fe72bc0c863
67d0275f-e986-4044-8419-c3d8cd9509fa	625e19c8-05aa-47b7-9468-d9d559efabd1	727ec9c1-79ad-4c07-acfe-8daf9690fb2c	3ea17821-fe0c-467b-8ee4-d8a1716c8db4	success	\N	\N	dc08e570-44d7-4373-843b-0cd690c80bef	\N
9220fa6d-f58c-40b4-9213-da1d265c816b	625e19c8-05aa-47b7-9468-d9d559efabd1	0a9ab69a-3e34-41bd-91bd-2ff1a9611e13	32464d68-d517-4fda-9cdb-e04204f8efe9	success	\N	\N	5449871f-b5c1-4e28-b17f-cf85d4e4f528	\N
95bb18fd-1db5-4b03-b854-d063f143fb06	625e19c8-05aa-47b7-9468-d9d559efabd1	31c63922-7346-414c-8346-deae09984763	71a3fc19-abba-49d9-a693-c3acaed40168	success	\N	\N	37c813a7-0985-4bc2-887f-7383fd844347	\N
fc1ddda0-3042-44f6-83d1-7651b0d102e2	625e19c8-05aa-47b7-9468-d9d559efabd1	ca7c6bc9-5e44-424f-8fe2-75c5b00201a0	a06ed6d7-559b-4f15-ba70-719f1a96648d	success	\N	\N	92efd31c-19cd-4464-9c3a-e933a471e23a	\N
26a01167-5c11-4fd3-9eba-dfa822070abb	625e19c8-05aa-47b7-9468-d9d559efabd1	60ecc394-6aa6-491e-a094-cbb3dc6a48e9	85d60df5-5232-449c-ad18-0f0fb46bf583	success	\N	fed28b36c0606c5bd08de8730107fe31e07ab3e40192f218c5e959a6a46d4e7c	9ead2865-d490-4fe4-8f00-07c6373618bd	\N
26f56b03-a435-44d2-9657-1c5c746903e2	625e19c8-05aa-47b7-9468-d9d559efabd1	512e5df4-5b71-4063-86b2-bf4383fa076c	00df99b7-d3c2-448e-a3cf-136f052188e1	success	\N	dc834505aa32a48ceba531a3f4250954a089295abfd74d915b85f3a40aea966d	cbc11b9e-c021-420f-85d8-b8eeb29efcd5	\N
584db9fc-8df5-4cff-8bb5-c13839fbfdbe	625e19c8-05aa-47b7-9468-d9d559efabd1	f770ce3f-2c85-41d6-b30e-55e2cde77409	01dba1fc-b97c-4186-be58-cd7777eb89a5	success	\N	a826cad0fd87dfa910d8ae84a5824c009b6fe6305a848baa1bfab391ac92aa70	874b9530-5d41-44a6-b8e1-0c0fc1cc3f84	\N
5870be17-498b-49ed-867b-ede5964be434	625e19c8-05aa-47b7-9468-d9d559efabd1	45a52008-364c-4668-b267-e9a1e68cb835	cdc5c880-352e-40d1-8c7d-a993b2b39df5	success	\N	1b53099e0f0e744077df78526d66105c257cda857f51cacd84c73354d2889cf4	9c4358d2-1005-4826-85ee-7818001a2233	\N
6f8e7d85-bf5a-4be5-bf37-57af7b109dd6	625e19c8-05aa-47b7-9468-d9d559efabd1	35a65074-15a4-471a-b62d-560656bb7cc0	e6c8f581-ea52-4197-b14d-bde1a5f4cec9	success	\N	6c8f2eb67fe5d3697e6a29fe8af0109b0f2f120e087794aed5635f2119676c2d	9d9ff4c9-5ad1-44b8-8292-f8cc6bed0d5e	\N
a87939e4-19ed-427c-987b-edafad25c792	625e19c8-05aa-47b7-9468-d9d559efabd1	7c99aa26-bd79-4af6-b3a6-c12d584a74a3	1aa63836-efcd-4e55-80f3-55e1371df090	success	\N	77a67d963830925cc36b7cfbba4f72cf8766fcecd6b11acd517296026f027f71	abba76a9-7809-42a5-a223-8e3963b1bc6e	\N
dacce7eb-0dcc-4fbb-9ef8-f4143ef1f9ef	625e19c8-05aa-47b7-9468-d9d559efabd1	dbd047a8-f3e5-475c-8acd-b009407de2e1	f137ef20-f5f3-4ab3-adaa-a3b95bde5caa	success	\N	bce7ac09b6af9bcdf0be38f74201a9d618d762ed5752643572940e275b88cbab	8bcfc2a0-ba65-4345-a5bd-39059ed3f7fa	\N
f987bc2a-2343-4a5f-998d-8f035e7cd163	625e19c8-05aa-47b7-9468-d9d559efabd1	946fe89f-61ca-41a3-b193-878471e439c2	fdf9215b-960a-44d3-98f9-6683a2c590f7	success	\N	4e4e43d47287c2256c8e7649285767e12d384fc9923a52a43ddd48315f61a1d9	75be29ab-c5a7-4cc1-acec-223deec3ab83	\N
0dd0eb9c-c1b3-4905-b632-fbe6b7feaa82	ea5c8fbf-3461-4687-af87-9d33d5a1a18b	31c63922-7346-414c-8346-deae09984763	71a3fc19-abba-49d9-a693-c3acaed40168	success	\N	\N	\N	608836e9-2434-4891-bb7b-a925cdff4ee6
32a12b2a-1949-4cb3-a35a-8bdeb2f2f464	ea5c8fbf-3461-4687-af87-9d33d5a1a18b	727ec9c1-79ad-4c07-acfe-8daf9690fb2c	3ea17821-fe0c-467b-8ee4-d8a1716c8db4	success	\N	\N	\N	50b8625c-8a21-49b9-a138-9ba5275a88ed
944bcade-2038-4d57-9f5a-fd49d66be01e	ea5c8fbf-3461-4687-af87-9d33d5a1a18b	ca7c6bc9-5e44-424f-8fe2-75c5b00201a0	a06ed6d7-559b-4f15-ba70-719f1a96648d	success	\N	\N	\N	9c9dbb3f-890d-4f78-b7c4-6fe72bc0c863
b76bdbc6-3503-41b0-a65e-07cd6fe3ca8b	ea5c8fbf-3461-4687-af87-9d33d5a1a18b	0a9ab69a-3e34-41bd-91bd-2ff1a9611e13	32464d68-d517-4fda-9cdb-e04204f8efe9	success	\N	\N	\N	a014fdc2-6652-4add-8a8c-ee98505b6d77
5b313ad1-36d6-4f2e-86e6-0af007ddd2bb	ea5c8fbf-3461-4687-af87-9d33d5a1a18b	f770ce3f-2c85-41d6-b30e-55e2cde77409	01dba1fc-b97c-4186-be58-cd7777eb89a5	success	\N	d398cba9fc652c9ffe0956d2df773b9f3c271748e38940376d5cc55d41bb0a7f	\N	66d56de5-8e77-49a9-a73a-8a05e4c711a8
5d888dc1-e0e0-419e-ac76-41b0382b1f7f	ea5c8fbf-3461-4687-af87-9d33d5a1a18b	7c99aa26-bd79-4af6-b3a6-c12d584a74a3	1aa63836-efcd-4e55-80f3-55e1371df090	success	\N	9684f43a5361b27e61d863d9ab1cac812229519cb1a50d4f4a7a6521087263b9	\N	cc6bafaa-f955-4612-a945-2d039b8c2d4d
70043ad6-020f-4628-8c79-9d5da787fd43	ea5c8fbf-3461-4687-af87-9d33d5a1a18b	60ecc394-6aa6-491e-a094-cbb3dc6a48e9	85d60df5-5232-449c-ad18-0f0fb46bf583	success	\N	af967551c90ab64ffe1334d395c9e5eb952060e698e99f6aa6addb5e1d5ef35c	\N	1827fe81-5153-4e0a-a076-89fbf28f8ad3
3048fb4e-f276-49af-8178-fdc72d36c162	ea5c8fbf-3461-4687-af87-9d33d5a1a18b	946fe89f-61ca-41a3-b193-878471e439c2	fdf9215b-960a-44d3-98f9-6683a2c590f7	success	\N	da3f0f3b001ebcc6264ac545842cef441742178bed6dff2ea58059635d40cca3	\N	6c14bcfe-3e6b-4291-b6b4-72cb1de7e870
73b18dbf-52c5-4471-b54e-ae53656033e3	ea5c8fbf-3461-4687-af87-9d33d5a1a18b	512e5df4-5b71-4063-86b2-bf4383fa076c	00df99b7-d3c2-448e-a3cf-136f052188e1	success	\N	22b886b20ddf3e958b7c7b7d0f2cf15dda97be4b9549265486b03b10f031c354	\N	37d62946-d10b-484a-b326-afda84362b20
a24e25f3-4855-428e-9193-7cbf3dd6aa20	ea5c8fbf-3461-4687-af87-9d33d5a1a18b	dbd047a8-f3e5-475c-8acd-b009407de2e1	f137ef20-f5f3-4ab3-adaa-a3b95bde5caa	success	\N	7a6430fde13c0ecadd2b14ac3f171fdfbffd7a01c077b15c512cf7d1b2335de1	\N	70780b8c-ea7b-40fe-9079-52891964d400
c19aa558-589c-4cf0-b252-ba03ac92ee16	ea5c8fbf-3461-4687-af87-9d33d5a1a18b	35a65074-15a4-471a-b62d-560656bb7cc0	e6c8f581-ea52-4197-b14d-bde1a5f4cec9	success	\N	c2ccf22065045f197c4899227ca274121b4e2eb5d3c15b110372e51277ac7b7d	\N	edc48ddc-1ff1-4fde-bcae-7bd96aa328e4
dbb901e5-f18f-4e06-b79f-98ff6f6086b1	ea5c8fbf-3461-4687-af87-9d33d5a1a18b	45a52008-364c-4668-b267-e9a1e68cb835	cdc5c880-352e-40d1-8c7d-a993b2b39df5	success	\N	355a6a16cbf97bf0d777bce8222654035b29c9bfd7fa46930f59600595008b02	\N	c6451bc3-a3d1-4f33-8fa0-39c8ebf74d9f
28770caa-d208-447f-97e5-fc8429827de4	20f217c8-8c0f-4b40-b570-2e338a06a8af	45a52008-364c-4668-b267-e9a1e68cb835	cdc5c880-352e-40d1-8c7d-a993b2b39df5	success	\N	\N	9c4358d2-1005-4826-85ee-7818001a2233	\N
321dede6-e466-4a20-a78f-454fee96246b	20f217c8-8c0f-4b40-b570-2e338a06a8af	f770ce3f-2c85-41d6-b30e-55e2cde77409	01dba1fc-b97c-4186-be58-cd7777eb89a5	success	\N	\N	874b9530-5d41-44a6-b8e1-0c0fc1cc3f84	\N
7bd1c192-c01c-4bc4-8c99-52a319baf8d5	20f217c8-8c0f-4b40-b570-2e338a06a8af	0a9ab69a-3e34-41bd-91bd-2ff1a9611e13	32464d68-d517-4fda-9cdb-e04204f8efe9	success	\N	\N	5449871f-b5c1-4e28-b17f-cf85d4e4f528	\N
80071f32-789f-45a8-a714-ac5991214c23	20f217c8-8c0f-4b40-b570-2e338a06a8af	35a65074-15a4-471a-b62d-560656bb7cc0	e6c8f581-ea52-4197-b14d-bde1a5f4cec9	success	\N	\N	9d9ff4c9-5ad1-44b8-8292-f8cc6bed0d5e	\N
8050d2d2-4dab-4d8d-bb25-1e8f22721f13	20f217c8-8c0f-4b40-b570-2e338a06a8af	dbd047a8-f3e5-475c-8acd-b009407de2e1	f137ef20-f5f3-4ab3-adaa-a3b95bde5caa	success	\N	\N	8bcfc2a0-ba65-4345-a5bd-39059ed3f7fa	\N
82220e65-67b9-411d-a38a-762c6a5a1d80	20f217c8-8c0f-4b40-b570-2e338a06a8af	946fe89f-61ca-41a3-b193-878471e439c2	fdf9215b-960a-44d3-98f9-6683a2c590f7	success	\N	\N	75be29ab-c5a7-4cc1-acec-223deec3ab83	\N
cabcf655-aa29-4280-a4d0-367f6b797ac5	20f217c8-8c0f-4b40-b570-2e338a06a8af	7c99aa26-bd79-4af6-b3a6-c12d584a74a3	1aa63836-efcd-4e55-80f3-55e1371df090	success	\N	\N	abba76a9-7809-42a5-a223-8e3963b1bc6e	\N
dc60032d-dde8-414e-88f8-828ecb4b1d5b	20f217c8-8c0f-4b40-b570-2e338a06a8af	727ec9c1-79ad-4c07-acfe-8daf9690fb2c	3ea17821-fe0c-467b-8ee4-d8a1716c8db4	success	\N	\N	dc08e570-44d7-4373-843b-0cd690c80bef	\N
e314e008-2f08-41ec-aec5-92677aa12004	20f217c8-8c0f-4b40-b570-2e338a06a8af	ca7c6bc9-5e44-424f-8fe2-75c5b00201a0	a06ed6d7-559b-4f15-ba70-719f1a96648d	success	\N	\N	92efd31c-19cd-4464-9c3a-e933a471e23a	\N
eb49387a-48fa-4f79-a310-2d62154386c1	20f217c8-8c0f-4b40-b570-2e338a06a8af	60ecc394-6aa6-491e-a094-cbb3dc6a48e9	85d60df5-5232-449c-ad18-0f0fb46bf583	success	\N	\N	9ead2865-d490-4fe4-8f00-07c6373618bd	\N
f4fe48ca-487e-4d5e-9364-7323e4e992ee	20f217c8-8c0f-4b40-b570-2e338a06a8af	31c63922-7346-414c-8346-deae09984763	71a3fc19-abba-49d9-a693-c3acaed40168	success	\N	\N	37c813a7-0985-4bc2-887f-7383fd844347	\N
f5d8988a-9277-49b7-86bc-758380aba3f2	20f217c8-8c0f-4b40-b570-2e338a06a8af	512e5df4-5b71-4063-86b2-bf4383fa076c	00df99b7-d3c2-448e-a3cf-136f052188e1	success	\N	\N	cbc11b9e-c021-420f-85d8-b8eeb29efcd5	\N
21565580-dde6-46e6-a5b8-aa51e2483408	2309303a-fa70-41e9-bb71-2152fbfa3318	f770ce3f-2c85-41d6-b30e-55e2cde77409	01dba1fc-b97c-4186-be58-cd7777eb89a5	success	\N	\N	\N	66d56de5-8e77-49a9-a73a-8a05e4c711a8
5dc20c57-7c6b-4a1e-b68a-bd064605adf3	2309303a-fa70-41e9-bb71-2152fbfa3318	512e5df4-5b71-4063-86b2-bf4383fa076c	00df99b7-d3c2-448e-a3cf-136f052188e1	success	\N	\N	\N	37d62946-d10b-484a-b326-afda84362b20
61222639-f6ec-4f5d-acf8-7a8a67736032	2309303a-fa70-41e9-bb71-2152fbfa3318	dbd047a8-f3e5-475c-8acd-b009407de2e1	f137ef20-f5f3-4ab3-adaa-a3b95bde5caa	success	\N	\N	\N	70780b8c-ea7b-40fe-9079-52891964d400
716e0cb5-308e-4eb5-b5f9-73d40627eff8	2309303a-fa70-41e9-bb71-2152fbfa3318	31c63922-7346-414c-8346-deae09984763	71a3fc19-abba-49d9-a693-c3acaed40168	success	\N	\N	\N	608836e9-2434-4891-bb7b-a925cdff4ee6
801fe3d9-367f-4e97-809f-0292dd4ad6a1	2309303a-fa70-41e9-bb71-2152fbfa3318	35a65074-15a4-471a-b62d-560656bb7cc0	e6c8f581-ea52-4197-b14d-bde1a5f4cec9	success	\N	\N	\N	edc48ddc-1ff1-4fde-bcae-7bd96aa328e4
ba547890-bed2-4c60-8264-bfcfdf7c8c2d	2309303a-fa70-41e9-bb71-2152fbfa3318	7c99aa26-bd79-4af6-b3a6-c12d584a74a3	1aa63836-efcd-4e55-80f3-55e1371df090	success	\N	\N	\N	cc6bafaa-f955-4612-a945-2d039b8c2d4d
ccd8f1e9-f3cd-4aad-9732-0179e4773af7	2309303a-fa70-41e9-bb71-2152fbfa3318	946fe89f-61ca-41a3-b193-878471e439c2	fdf9215b-960a-44d3-98f9-6683a2c590f7	success	\N	\N	\N	6c14bcfe-3e6b-4291-b6b4-72cb1de7e870
ce6a3fe2-cf4a-48b6-81b8-11fc2838bd0d	2309303a-fa70-41e9-bb71-2152fbfa3318	45a52008-364c-4668-b267-e9a1e68cb835	cdc5c880-352e-40d1-8c7d-a993b2b39df5	success	\N	\N	\N	c6451bc3-a3d1-4f33-8fa0-39c8ebf74d9f
d53a2e8d-b1ae-4457-93eb-4b260289ab1d	2309303a-fa70-41e9-bb71-2152fbfa3318	0a9ab69a-3e34-41bd-91bd-2ff1a9611e13	32464d68-d517-4fda-9cdb-e04204f8efe9	success	\N	\N	\N	a014fdc2-6652-4add-8a8c-ee98505b6d77
e3510a35-3376-49cd-92f3-b658fc938199	2309303a-fa70-41e9-bb71-2152fbfa3318	ca7c6bc9-5e44-424f-8fe2-75c5b00201a0	a06ed6d7-559b-4f15-ba70-719f1a96648d	success	\N	\N	\N	9c9dbb3f-890d-4f78-b7c4-6fe72bc0c863
f2fbc9be-66b3-4ce8-8eeb-c8efba22bd20	2309303a-fa70-41e9-bb71-2152fbfa3318	727ec9c1-79ad-4c07-acfe-8daf9690fb2c	3ea17821-fe0c-467b-8ee4-d8a1716c8db4	success	\N	\N	\N	50b8625c-8a21-49b9-a138-9ba5275a88ed
f7549799-2f07-4c3e-880d-9ace8f2636c9	2309303a-fa70-41e9-bb71-2152fbfa3318	60ecc394-6aa6-491e-a094-cbb3dc6a48e9	85d60df5-5232-449c-ad18-0f0fb46bf583	success	\N	\N	\N	1827fe81-5153-4e0a-a076-89fbf28f8ad3
02cf6464-d10b-40ba-83d5-422c000a9694	402a505b-b702-40f1-8cc6-6b7571a1424a	7c99aa26-bd79-4af6-b3a6-c12d584a74a3	1aa63836-efcd-4e55-80f3-55e1371df090	success	\N	\N	abba76a9-7809-42a5-a223-8e3963b1bc6e	\N
1f4a51a8-f77b-4c8f-bc21-f79ed188738c	402a505b-b702-40f1-8cc6-6b7571a1424a	512e5df4-5b71-4063-86b2-bf4383fa076c	00df99b7-d3c2-448e-a3cf-136f052188e1	success	\N	\N	cbc11b9e-c021-420f-85d8-b8eeb29efcd5	\N
2f21a93a-f8f7-4867-8f6b-8c1c38897553	402a505b-b702-40f1-8cc6-6b7571a1424a	0a9ab69a-3e34-41bd-91bd-2ff1a9611e13	32464d68-d517-4fda-9cdb-e04204f8efe9	success	\N	\N	5449871f-b5c1-4e28-b17f-cf85d4e4f528	\N
38791f66-f73c-4d9a-ade6-aa0504ea2c61	402a505b-b702-40f1-8cc6-6b7571a1424a	ca7c6bc9-5e44-424f-8fe2-75c5b00201a0	a06ed6d7-559b-4f15-ba70-719f1a96648d	success	\N	\N	92efd31c-19cd-4464-9c3a-e933a471e23a	\N
4339fef2-09cd-40b2-b2c8-5cc0b1915f5d	402a505b-b702-40f1-8cc6-6b7571a1424a	727ec9c1-79ad-4c07-acfe-8daf9690fb2c	3ea17821-fe0c-467b-8ee4-d8a1716c8db4	success	\N	\N	dc08e570-44d7-4373-843b-0cd690c80bef	\N
4b897ad3-0e66-4b2e-8d00-a388c671509c	402a505b-b702-40f1-8cc6-6b7571a1424a	31c63922-7346-414c-8346-deae09984763	71a3fc19-abba-49d9-a693-c3acaed40168	success	\N	\N	37c813a7-0985-4bc2-887f-7383fd844347	\N
62203f0d-ed0d-4aeb-94ec-abf61783c2bc	402a505b-b702-40f1-8cc6-6b7571a1424a	45a52008-364c-4668-b267-e9a1e68cb835	cdc5c880-352e-40d1-8c7d-a993b2b39df5	success	\N	\N	9c4358d2-1005-4826-85ee-7818001a2233	\N
8778bad2-89b3-48ce-b780-6ed827f6fc32	402a505b-b702-40f1-8cc6-6b7571a1424a	f770ce3f-2c85-41d6-b30e-55e2cde77409	01dba1fc-b97c-4186-be58-cd7777eb89a5	success	\N	\N	874b9530-5d41-44a6-b8e1-0c0fc1cc3f84	\N
abc1e697-ffe2-4a0c-a0df-7cdef575cda0	402a505b-b702-40f1-8cc6-6b7571a1424a	35a65074-15a4-471a-b62d-560656bb7cc0	e6c8f581-ea52-4197-b14d-bde1a5f4cec9	success	\N	\N	9d9ff4c9-5ad1-44b8-8292-f8cc6bed0d5e	\N
ae470073-5beb-4de3-924c-07f24f0636b3	402a505b-b702-40f1-8cc6-6b7571a1424a	60ecc394-6aa6-491e-a094-cbb3dc6a48e9	85d60df5-5232-449c-ad18-0f0fb46bf583	success	\N	\N	9ead2865-d490-4fe4-8f00-07c6373618bd	\N
b79d8e31-fbea-4bd8-bafa-853a91e97cfb	402a505b-b702-40f1-8cc6-6b7571a1424a	946fe89f-61ca-41a3-b193-878471e439c2	fdf9215b-960a-44d3-98f9-6683a2c590f7	success	\N	\N	75be29ab-c5a7-4cc1-acec-223deec3ab83	\N
d3147ec3-3da5-4896-a6b3-a5bcc87db3eb	402a505b-b702-40f1-8cc6-6b7571a1424a	dbd047a8-f3e5-475c-8acd-b009407de2e1	f137ef20-f5f3-4ab3-adaa-a3b95bde5caa	success	\N	\N	8bcfc2a0-ba65-4345-a5bd-39059ed3f7fa	\N
0e97723d-6698-416a-9962-c75181858982	68baa369-86ec-4b14-9e19-3172dc624e4e	0a9ab69a-3e34-41bd-91bd-2ff1a9611e13	32464d68-d517-4fda-9cdb-e04204f8efe9	success	\N	\N	\N	a014fdc2-6652-4add-8a8c-ee98505b6d77
176d8ad5-9e88-4e4b-8824-c06651a4c83a	68baa369-86ec-4b14-9e19-3172dc624e4e	dbd047a8-f3e5-475c-8acd-b009407de2e1	f137ef20-f5f3-4ab3-adaa-a3b95bde5caa	success	\N	\N	\N	70780b8c-ea7b-40fe-9079-52891964d400
3d677792-f1d3-4ce0-a515-3cc89e6bc6ca	68baa369-86ec-4b14-9e19-3172dc624e4e	512e5df4-5b71-4063-86b2-bf4383fa076c	00df99b7-d3c2-448e-a3cf-136f052188e1	success	\N	\N	\N	37d62946-d10b-484a-b326-afda84362b20
3ecf2d47-09ba-473b-b9c3-d83c4135add3	68baa369-86ec-4b14-9e19-3172dc624e4e	ca7c6bc9-5e44-424f-8fe2-75c5b00201a0	a06ed6d7-559b-4f15-ba70-719f1a96648d	success	\N	\N	\N	9c9dbb3f-890d-4f78-b7c4-6fe72bc0c863
62f190ee-c62d-4c99-932e-c6df0b36f726	68baa369-86ec-4b14-9e19-3172dc624e4e	60ecc394-6aa6-491e-a094-cbb3dc6a48e9	85d60df5-5232-449c-ad18-0f0fb46bf583	success	\N	\N	\N	1827fe81-5153-4e0a-a076-89fbf28f8ad3
6995ed23-fe9f-4e6e-8730-201c30bdc4d4	68baa369-86ec-4b14-9e19-3172dc624e4e	45a52008-364c-4668-b267-e9a1e68cb835	cdc5c880-352e-40d1-8c7d-a993b2b39df5	success	\N	\N	\N	c6451bc3-a3d1-4f33-8fa0-39c8ebf74d9f
712dc625-cb37-4b6b-be7f-022b591a4b7a	68baa369-86ec-4b14-9e19-3172dc624e4e	35a65074-15a4-471a-b62d-560656bb7cc0	e6c8f581-ea52-4197-b14d-bde1a5f4cec9	success	\N	\N	\N	edc48ddc-1ff1-4fde-bcae-7bd96aa328e4
9c6dc8bb-d3a5-411a-a1d9-794c2aaf5b9f	68baa369-86ec-4b14-9e19-3172dc624e4e	946fe89f-61ca-41a3-b193-878471e439c2	fdf9215b-960a-44d3-98f9-6683a2c590f7	success	\N	\N	\N	6c14bcfe-3e6b-4291-b6b4-72cb1de7e870
9d818fe7-a668-4b6b-860f-52cce3c1ffb0	68baa369-86ec-4b14-9e19-3172dc624e4e	7c99aa26-bd79-4af6-b3a6-c12d584a74a3	1aa63836-efcd-4e55-80f3-55e1371df090	success	\N	\N	\N	cc6bafaa-f955-4612-a945-2d039b8c2d4d
9f752d81-43ec-4d11-828c-3335cb7c2b9e	68baa369-86ec-4b14-9e19-3172dc624e4e	31c63922-7346-414c-8346-deae09984763	71a3fc19-abba-49d9-a693-c3acaed40168	success	\N	\N	\N	608836e9-2434-4891-bb7b-a925cdff4ee6
c903428d-045e-4f23-ace4-af5b9497b1fe	68baa369-86ec-4b14-9e19-3172dc624e4e	f770ce3f-2c85-41d6-b30e-55e2cde77409	01dba1fc-b97c-4186-be58-cd7777eb89a5	success	\N	\N	\N	66d56de5-8e77-49a9-a73a-8a05e4c711a8
cbeb6704-102f-45a2-8a75-b9baf11eacfc	68baa369-86ec-4b14-9e19-3172dc624e4e	727ec9c1-79ad-4c07-acfe-8daf9690fb2c	3ea17821-fe0c-467b-8ee4-d8a1716c8db4	success	\N	\N	\N	50b8625c-8a21-49b9-a138-9ba5275a88ed
15f5f78a-a0ed-40e6-a6e1-1e5509dc353f	4662e586-3035-4d57-aa34-a349862b0987	4ccfd8f9-e500-4706-973a-3bbd09e63e74	5468500a-0345-4c3e-947f-117d267b4496	success	\N	0aa87809147299e18489d8be494c681b584e1e8d4627e9bd4b553be2deb9780b	547f5518-1ace-4e99-bc3c-685ec7e620d5	\N
8cfb157a-c8a4-4c06-ba8a-0097e45a78d8	4662e586-3035-4d57-aa34-a349862b0987	508fb791-a1f7-4b16-b012-3d62d176bde6	1348daf1-bd90-452d-a65e-97184357ea76	success	\N	e63e43a84b68200714661f95617b23f86f8ef9526897a5ed07dcf7e3c0cdcc9a	796782a5-0f9d-4f67-a55e-0586c3d756a1	\N
4e3d15b4-222b-4dcb-8fe3-eb5b3045d5b8	bfece1c3-2e7e-41cf-a591-32afc17a5f9f	4ccfd8f9-e500-4706-973a-3bbd09e63e74	5468500a-0345-4c3e-947f-117d267b4496	success	\N	18ac2d2e41ea129948fedde1d4683e8487961292f41e89c6ab6fa57145645482	\N	f8d6bd2b-8cb7-4a01-bc16-a7496511b833
8f8e9c8e-ba7d-4623-8883-4a2a06c72837	bfece1c3-2e7e-41cf-a591-32afc17a5f9f	508fb791-a1f7-4b16-b012-3d62d176bde6	1348daf1-bd90-452d-a65e-97184357ea76	success	\N	2d3a9b8d8e681bb9cdd100942e1543c53a5a164bb6f9aab89f826bd52fbf1a97	\N	dfecb4e8-bb61-455f-951f-f0b7b99b0171
\.


--
-- Data for Name: bulk_analysis_jobs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.bulk_analysis_jobs (id, import_job_id, actor_user_id, plan_key, task, model_version, artifact_sha256, metadata_sha256, persist_results, status, counts, attempts, error_code, created_at, started_at, completed_at) FROM stdin;
624be4b5-2613-42ba-b5e2-d0a042d037f6	87cef0f0-7e37-4f30-b802-e0a350539aea	ef370823-0afe-4928-b9a6-a682b68bf84b	0447a68a6ff7d9a9123cd231eea7927a54eb2828f870ebdcbd3843c253a1d7c9	segmentation	1.0.0	5ab101792571047b832c82d9b7e64390b158b788b140486742947bfbe796d7d1	1718061ac0a76657e9f17a2c7377d4cc4d7abcdaf1e5c09c84c8eee67d3326ae	f	completed	{"source_rows_without_snapshot": 0, "saved_new": 0, "saved_reused": 0, "total": 10, "queued": 0, "success": 10, "skipped": 0, "failed": 0}	0	\N	2026-11-05 13:43:06.22813+07	2026-11-05 13:43:06.275865+07	2026-11-05 13:43:06.303903+07
8d472a98-de02-4787-8031-307dfcf2c5f7	87cef0f0-7e37-4f30-b802-e0a350539aea	ef370823-0afe-4928-b9a6-a682b68bf84b	4cdaec7c725057c99a4ab8774d73a705424fa3a77570e45f1fe89faa78cb8de5	classification	1.0.0	1bbde6767f3b14bc5d29da3c848e53256363638f34e3263be0238e950e527e8f	f1e3b720cac81c5e078dbf45443c599c999c969d749cbbe11545bed3a78a0a65	t	completed	{"source_rows_without_snapshot": 0, "saved_new": 10, "saved_reused": 0, "total": 10, "queued": 0, "success": 10, "skipped": 0, "failed": 0}	0	\N	2026-11-05 13:38:02.806524+07	2026-11-05 13:38:02.878082+07	2026-11-05 13:38:03.03039+07
8de7a3d5-09fc-4cfc-b829-5374c31c039a	ca6f8676-4928-42aa-b592-3e3f0932f10a	5d4b6121-7923-44b5-81d0-5503f965de0b	e246df97f9661fb4a3d3a86459f44f472427113188f776111db4519a7d3d2333	segmentation	1.0.0	5ab101792571047b832c82d9b7e64390b158b788b140486742947bfbe796d7d1	1718061ac0a76657e9f17a2c7377d4cc4d7abcdaf1e5c09c84c8eee67d3326ae	t	completed	{"source_rows_without_snapshot": 0, "saved_new": 0, "saved_reused": 3, "total": 3, "queued": 0, "success": 3, "skipped": 0, "failed": 0}	0	\N	2026-11-18 20:47:33.19554+07	2026-11-18 20:47:33.260789+07	2026-11-18 20:47:33.275204+07
0d882cd9-4b46-4c09-a286-6b389da8efdd	87cef0f0-7e37-4f30-b802-e0a350539aea	ef370823-0afe-4928-b9a6-a682b68bf84b	8d0b845975369ede0c80aff88c389a19fac636947b153344d19e3e4962e4ff10	classification	2.0.0-snapshot-conservative12	b9b15c4170dade3d1a62cbfd9ce953e8770e7ac2cb4ff03266f3da3a39515ad3	ccdaefaec31065bd5b0034ba695950f0d8660471b8402c31c46687a91b102852	f	completed	{"source_rows_without_snapshot": 0, "saved_new": 0, "saved_reused": 0, "total": 10, "queued": 0, "success": 10, "skipped": 0, "failed": 0}	0	\N	2026-11-05 13:44:00.510299+07	2026-11-05 13:44:00.561772+07	2026-11-05 13:44:00.595097+07
51b206a9-f0b7-44d5-af62-5352ed488f79	87cef0f0-7e37-4f30-b802-e0a350539aea	ef370823-0afe-4928-b9a6-a682b68bf84b	bebb3adef3d79684b8a657586dcb58e74c6427dde8d66618a48813d4458c5cbc	segmentation	1.0.0	5ab101792571047b832c82d9b7e64390b158b788b140486742947bfbe796d7d1	1718061ac0a76657e9f17a2c7377d4cc4d7abcdaf1e5c09c84c8eee67d3326ae	t	completed	{"source_rows_without_snapshot": 0, "saved_new": 10, "saved_reused": 0, "total": 10, "queued": 0, "success": 10, "skipped": 0, "failed": 0}	0	\N	2026-11-05 13:38:03.085231+07	2026-11-05 13:38:03.126744+07	2026-11-05 13:38:03.208171+07
bca817b2-db34-41bb-adaa-237e58cebd28	d3a33009-7f67-4ada-a769-9adc7ab987a6	5d4b6121-7923-44b5-81d0-5503f965de0b	372a76d7c71cbee70d400a4b9a7d60394a18e7bae6d51a2e95a9e64d48013cc5	classification	1.0.0	1bbde6767f3b14bc5d29da3c848e53256363638f34e3263be0238e950e527e8f	f1e3b720cac81c5e078dbf45443c599c999c969d749cbbe11545bed3a78a0a65	t	completed	{"source_rows_without_snapshot": 0, "saved_new": 4, "saved_reused": 0, "total": 4, "queued": 0, "success": 4, "skipped": 0, "failed": 0}	0	\N	2026-11-16 19:39:59.994347+07	2026-11-16 19:40:00.076131+07	2026-11-16 19:40:00.13513+07
8e15ba52-267c-47d6-86b9-44ea3a0d2e07	87cef0f0-7e37-4f30-b802-e0a350539aea	ef370823-0afe-4928-b9a6-a682b68bf84b	c2d986a9d8b2822bb99c3a965a3009516c4902ef278b52464eca197f159b5042	classification	1.0.0	1bbde6767f3b14bc5d29da3c848e53256363638f34e3263be0238e950e527e8f	f1e3b720cac81c5e078dbf45443c599c999c969d749cbbe11545bed3a78a0a65	f	completed	{"source_rows_without_snapshot": 0, "saved_new": 0, "saved_reused": 0, "total": 10, "queued": 0, "success": 10, "skipped": 0, "failed": 0}	0	\N	2026-11-05 13:43:06.107804+07	2026-11-05 13:43:06.154595+07	2026-11-05 13:43:06.181279+07
27182fd3-a89b-41c9-b9aa-fa86babe73ae	ca6f8676-4928-42aa-b592-3e3f0932f10a	5d4b6121-7923-44b5-81d0-5503f965de0b	4871115f1052ec500dc4fe4219f148878b52534276f7d0c5f23c4c46cf061f2a	classification	1.0.0	1bbde6767f3b14bc5d29da3c848e53256363638f34e3263be0238e950e527e8f	f1e3b720cac81c5e078dbf45443c599c999c969d749cbbe11545bed3a78a0a65	t	completed	{"source_rows_without_snapshot": 0, "saved_new": 0, "saved_reused": 3, "total": 3, "queued": 0, "success": 3, "skipped": 0, "failed": 0}	0	\N	2026-11-18 20:47:32.973647+07	2026-11-18 20:47:33.075888+07	2026-11-18 20:47:33.109143+07
7ca4e8e4-bce1-4c5b-b24a-18fef5f23308	87cef0f0-7e37-4f30-b802-e0a350539aea	ef370823-0afe-4928-b9a6-a682b68bf84b	0922ae88c6cf3578fa68c769da3014a16d9c646f40f5a3aa8d814f6d193c0a64	segmentation	2.0.0-snapshot-k3	fcccee53765f9d4825196411aee4a971d1df8a3595b0d4f56210145425e672e3	929e2edc11aea9244ee60681e64f0e762eb4af1fb56fd78cb199feb290de86c3	f	completed	{"source_rows_without_snapshot": 0, "saved_new": 0, "saved_reused": 0, "total": 10, "queued": 0, "success": 10, "skipped": 0, "failed": 0}	0	\N	2026-11-05 13:44:00.643936+07	2026-11-05 13:44:00.694807+07	2026-11-05 13:44:00.728266+07
527831fc-e34c-4096-80b8-e8a0fc42d5b6	d3a33009-7f67-4ada-a769-9adc7ab987a6	5d4b6121-7923-44b5-81d0-5503f965de0b	44c1541a33b52f8e6c166ce9149ca1ce82aeea801359e63eb204a73b2e65b7fd	segmentation	1.0.0	5ab101792571047b832c82d9b7e64390b158b788b140486742947bfbe796d7d1	1718061ac0a76657e9f17a2c7377d4cc4d7abcdaf1e5c09c84c8eee67d3326ae	t	completed	{"source_rows_without_snapshot": 0, "saved_new": 4, "saved_reused": 0, "total": 4, "queued": 0, "success": 4, "skipped": 0, "failed": 0}	0	\N	2026-11-16 19:40:00.186082+07	2026-11-16 19:40:00.242163+07	2026-11-16 19:40:00.335393+07
625e19c8-05aa-47b7-9468-d9d559efabd1	454eda24-95dd-45f8-8529-0aea74e06f33	5d4b6121-7923-44b5-81d0-5503f965de0b	8b27c724eac5b85febc42655177ba34d28f954e3629acbb01738fee923413d93	classification	1.0.0	1bbde6767f3b14bc5d29da3c848e53256363638f34e3263be0238e950e527e8f	f1e3b720cac81c5e078dbf45443c599c999c969d749cbbe11545bed3a78a0a65	t	completed	{"source_rows_without_snapshot": 0, "saved_new": 8, "saved_reused": 4, "total": 12, "queued": 0, "success": 12, "skipped": 0, "failed": 0}	0	\N	2026-11-19 19:32:49.213321+07	2026-11-19 19:32:49.316435+07	2026-11-19 19:32:49.626829+07
ea5c8fbf-3461-4687-af87-9d33d5a1a18b	454eda24-95dd-45f8-8529-0aea74e06f33	5d4b6121-7923-44b5-81d0-5503f965de0b	c7be99ce522e73de6a124738ce4c77893a909237f62e67db74568012a4297f34	segmentation	1.0.0	5ab101792571047b832c82d9b7e64390b158b788b140486742947bfbe796d7d1	1718061ac0a76657e9f17a2c7377d4cc4d7abcdaf1e5c09c84c8eee67d3326ae	t	completed	{"source_rows_without_snapshot": 0, "saved_new": 8, "saved_reused": 4, "total": 12, "queued": 0, "success": 12, "skipped": 0, "failed": 0}	0	\N	2026-11-19 19:32:49.702546+07	2026-11-19 19:32:49.795206+07	2026-11-19 19:32:49.966313+07
20f217c8-8c0f-4b40-b570-2e338a06a8af	21a1d4a6-dc73-4959-91a1-8379cd61ec88	5d4b6121-7923-44b5-81d0-5503f965de0b	fa5fc86ac572cd4e2d48a9381f9b794387af01d509ea78d501db4dc040ae849f	classification	1.0.0	1bbde6767f3b14bc5d29da3c848e53256363638f34e3263be0238e950e527e8f	f1e3b720cac81c5e078dbf45443c599c999c969d749cbbe11545bed3a78a0a65	t	completed	{"source_rows_without_snapshot": 0, "saved_new": 0, "saved_reused": 12, "total": 12, "queued": 0, "success": 12, "skipped": 0, "failed": 0}	0	\N	2026-11-19 20:02:16.069304+07	2026-11-19 20:02:16.14562+07	2026-11-19 20:02:16.162713+07
2309303a-fa70-41e9-bb71-2152fbfa3318	21a1d4a6-dc73-4959-91a1-8379cd61ec88	5d4b6121-7923-44b5-81d0-5503f965de0b	a5f82e2031436ed3b3c78283f376580057c0b274dd29928f781ce487b60eadb2	segmentation	1.0.0	5ab101792571047b832c82d9b7e64390b158b788b140486742947bfbe796d7d1	1718061ac0a76657e9f17a2c7377d4cc4d7abcdaf1e5c09c84c8eee67d3326ae	t	completed	{"source_rows_without_snapshot": 0, "saved_new": 0, "saved_reused": 12, "total": 12, "queued": 0, "success": 12, "skipped": 0, "failed": 0}	0	\N	2026-11-19 20:02:16.225321+07	2026-11-19 20:02:16.333495+07	2026-11-19 20:02:16.349511+07
402a505b-b702-40f1-8cc6-6b7571a1424a	d4783698-ae56-4533-b6ce-bab50e68ca9b	5d4b6121-7923-44b5-81d0-5503f965de0b	ba51fcae8ab0b60b3842a581b4788df8ea278a409108e6392625da5ddab41eff	classification	1.0.0	1bbde6767f3b14bc5d29da3c848e53256363638f34e3263be0238e950e527e8f	f1e3b720cac81c5e078dbf45443c599c999c969d749cbbe11545bed3a78a0a65	t	completed	{"source_rows_without_snapshot": 0, "saved_new": 0, "saved_reused": 12, "total": 12, "queued": 0, "success": 12, "skipped": 0, "failed": 0}	0	\N	2026-11-20 18:13:43.78167+07	2026-11-20 18:13:43.886185+07	2026-11-20 18:13:43.928069+07
bfece1c3-2e7e-41cf-a591-32afc17a5f9f	f79a2e48-e9f3-4b96-b206-46b3eee6b46e	5d4b6121-7923-44b5-81d0-5503f965de0b	8d5a719d20c86904cd5e87b58d4f282ecede5cc31f5ee1a4e3154d9b1902792a	segmentation	1.0.0	5ab101792571047b832c82d9b7e64390b158b788b140486742947bfbe796d7d1	1718061ac0a76657e9f17a2c7377d4cc4d7abcdaf1e5c09c84c8eee67d3326ae	t	completed	{"source_rows_without_snapshot": 0, "saved_new": 2, "saved_reused": 0, "total": 2, "queued": 0, "success": 2, "skipped": 0, "failed": 0}	0	\N	2026-11-24 20:08:08.457171+07	2026-11-24 20:08:08.520815+07	2026-11-24 20:08:08.653847+07
68baa369-86ec-4b14-9e19-3172dc624e4e	d4783698-ae56-4533-b6ce-bab50e68ca9b	5d4b6121-7923-44b5-81d0-5503f965de0b	2c120c42bc853580e981e99f6b1701ec85755a2b97ebc3f3f9ef2b101adb0d44	segmentation	1.0.0	5ab101792571047b832c82d9b7e64390b158b788b140486742947bfbe796d7d1	1718061ac0a76657e9f17a2c7377d4cc4d7abcdaf1e5c09c84c8eee67d3326ae	t	completed	{"source_rows_without_snapshot": 0, "saved_new": 0, "saved_reused": 12, "total": 12, "queued": 0, "success": 12, "skipped": 0, "failed": 0}	0	\N	2026-11-20 18:13:43.99989+07	2026-11-20 18:13:44.102009+07	2026-11-20 18:13:44.12001+07
4662e586-3035-4d57-aa34-a349862b0987	f79a2e48-e9f3-4b96-b206-46b3eee6b46e	5d4b6121-7923-44b5-81d0-5503f965de0b	583f3d3aa59e37acf78c477474737bdfc890405d00ffa03c8aacc18cd09c8930	classification	1.0.0	1bbde6767f3b14bc5d29da3c848e53256363638f34e3263be0238e950e527e8f	f1e3b720cac81c5e078dbf45443c599c999c969d749cbbe11545bed3a78a0a65	t	completed	{"source_rows_without_snapshot": 0, "saved_new": 2, "saved_reused": 0, "total": 2, "queued": 0, "success": 2, "skipped": 0, "failed": 0}	0	\N	2026-11-24 20:08:08.067515+07	2026-11-24 20:08:08.188171+07	2026-11-24 20:08:08.37845+07
\.


--
-- Data for Name: bulk_import_jobs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.bulk_import_jobs (id, actor_user_id, actor_session_id, idempotency_key, manifest_digest, file_fingerprint, status, metadata_json, counts, error_code, error_row, created_at, completed_at) FROM stdin;
87cef0f0-7e37-4f30-b802-e0a350539aea	ef370823-0afe-4928-b9a6-a682b68bf84b	41850457-cec3-4ccd-8f31-149c6ea544e8	86caf0bf-1400-4c78-8153-6f33f83dc21f	62fcaca743b8d7c608a68c4dfdd8c6ec9de4b6c921becf4ac77741720fd60fdb	acd7f7937abc30fdcf50c54b4d63ca229f0b1f9e7552bb398f6c68b78ef1eb77	completed	{"request_hash": "f4ccb61827d4136c215fc8c9acfbe9e2266450bd577d3f81191c9dca7c9dbe89", "dataset_type": "behavior", "contract_version": "bulk-input-v1", "filename": "MK_eAI_kaggle_10_customers.csv", "sources": ["kaggle-v1-demo"], "mapping": {"Age": "Age", "Average_Order_Value": "Average_Order_Value", "Cart_Abandonment_Rate": "Cart_Abandonment_Rate", "Churned": "Churned", "City": "City", "Country": "Country", "Credit_Balance": "Credit_Balance", "Customer_Service_Calls": "Customer_Service_Calls", "Days_Since_Last_Purchase": "Days_Since_Last_Purchase", "Discount_Usage_Rate": "Discount_Usage_Rate", "Email_Open_Rate": "Email_Open_Rate", "Gender": "Gender", "Lifetime_Value": "Lifetime_Value", "Login_Frequency": "Login_Frequency", "Membership_Years": "Membership_Years", "Mobile_App_Usage": "Mobile_App_Usage", "Pages_Per_Session": "Pages_Per_Session", "Payment_Method_Diversity": "Payment_Method_Diversity", "Product_Reviews_Written": "Product_Reviews_Written", "Returns_Rate": "Returns_Rate", "Session_Duration_Avg": "Session_Duration_Avg", "Signup_Quarter": "Signup_Quarter", "Social_Media_Engagement_Score": "Social_Media_Engagement_Score", "Total_Purchases": "Total_Purchases", "Wishlist_Items": "Wishlist_Items", "captured_at": "captured_at", "external_id": "external_id", "source": "source"}, "profile": "snapshot", "accepted_partial": false, "acknowledge_import": true}	{"duplicate": 0, "error": 0, "skipped": 0, "snapshot_eligible": 10, "snapshot_ineligible": 0, "total": 10, "valid": 10, "warning": 10, "customers_created": 10, "customers_matched": 0, "customers_updated": 0, "snapshots_created": 10, "snapshots_skipped": 0, "snapshots_ineligible": 0}	\N	\N	2026-11-05 09:27:28.686791+07	2026-11-05 09:27:28.887337+07
ca6f8676-4928-42aa-b592-3e3f0932f10a	5d4b6121-7923-44b5-81d0-5503f965de0b	511513e7-8faf-46c2-9472-31479bd794a0	4f67b9d8-aa0c-4115-99aa-9551f91f0267	3017e3f3864f52d27347d095669ffaf509f802440135db4d35075f746cf0a9e4	b8b1943170786050fe5c462d3ce882c5825f76d73ddac584d6aed0c981e4fa4b	completed	{"request_hash": "7750e7368a65ebd697deaa0db632d3d3f1ac61de785156ea45f876e5a515faae", "dataset_type": "behavior", "contract_version": "bulk-input-v1", "filename": "test3.csv", "sources": ["kaggle-v1-bao-ve"], "mapping": {"Age": "Age", "Average_Order_Value": "Average_Order_Value", "Cart_Abandonment_Rate": "Cart_Abandonment_Rate", "Churned": "Churned", "City": "City", "Country": "Country", "Credit_Balance": "Credit_Balance", "Customer_Service_Calls": "Customer_Service_Calls", "Days_Since_Last_Purchase": "Days_Since_Last_Purchase", "Discount_Usage_Rate": "Discount_Usage_Rate", "Email_Open_Rate": "Email_Open_Rate", "Gender": "Gender", "Lifetime_Value": "Lifetime_Value", "Login_Frequency": "Login_Frequency", "Membership_Years": "Membership_Years", "Mobile_App_Usage": "Mobile_App_Usage", "Pages_Per_Session": "Pages_Per_Session", "Payment_Method_Diversity": "Payment_Method_Diversity", "Product_Reviews_Written": "Product_Reviews_Written", "Returns_Rate": "Returns_Rate", "Session_Duration_Avg": "Session_Duration_Avg", "Signup_Quarter": "Signup_Quarter", "Social_Media_Engagement_Score": "Social_Media_Engagement_Score", "Total_Purchases": "Total_Purchases", "Wishlist_Items": "Wishlist_Items", "captured_at": "captured_at", "external_id": "external_id", "source": "source"}, "profile": "snapshot", "accepted_partial": false, "acknowledge_import": true}	{"duplicate": 0, "error": 0, "skipped": 0, "snapshot_eligible": 3, "snapshot_ineligible": 0, "total": 3, "valid": 3, "warning": 3, "customers_created": 3, "customers_matched": 0, "customers_updated": 0, "snapshots_created": 3, "snapshots_skipped": 0, "snapshots_ineligible": 0}	\N	\N	2026-11-16 19:13:54.012848+07	2026-11-16 19:13:54.11528+07
d3a33009-7f67-4ada-a769-9adc7ab987a6	5d4b6121-7923-44b5-81d0-5503f965de0b	511513e7-8faf-46c2-9472-31479bd794a0	a5052320-b24b-4a25-9c51-71b23d7a1eb5	775fb4fa795ce7787d443af945fb2419d22af09160c7e87f8001b645c2593226	a1bfb11b6b53f7471d0c85d5fd57461136a3e4044414311a09852a355f07a884	completed	{"request_hash": "1cb7e8ddb993ea9f8a169094a11d0a6b77008b0b0bb0be4c43408a337535bd4a", "dataset_type": "behavior", "contract_version": "bulk-input-v1", "filename": "test3.csv", "sources": ["kaggle-v1-bao-ve"], "mapping": {"Age": "Age", "Average_Order_Value": "Average_Order_Value", "Cart_Abandonment_Rate": "Cart_Abandonment_Rate", "Churned": "Churned", "City": "City", "Country": "Country", "Credit_Balance": "Credit_Balance", "Customer_Service_Calls": "Customer_Service_Calls", "Days_Since_Last_Purchase": "Days_Since_Last_Purchase", "Discount_Usage_Rate": "Discount_Usage_Rate", "Email_Open_Rate": "Email_Open_Rate", "Gender": "Gender", "Lifetime_Value": "Lifetime_Value", "Login_Frequency": "Login_Frequency", "Membership_Years": "Membership_Years", "Mobile_App_Usage": "Mobile_App_Usage", "Pages_Per_Session": "Pages_Per_Session", "Payment_Method_Diversity": "Payment_Method_Diversity", "Product_Reviews_Written": "Product_Reviews_Written", "Returns_Rate": "Returns_Rate", "Session_Duration_Avg": "Session_Duration_Avg", "Signup_Quarter": "Signup_Quarter", "Social_Media_Engagement_Score": "Social_Media_Engagement_Score", "Total_Purchases": "Total_Purchases", "Wishlist_Items": "Wishlist_Items", "captured_at": "captured_at", "external_id": "external_id", "source": "source"}, "profile": "snapshot", "accepted_partial": false, "acknowledge_import": true}	{"duplicate": 0, "error": 0, "skipped": 0, "snapshot_eligible": 4, "snapshot_ineligible": 0, "total": 4, "valid": 4, "warning": 4, "customers_created": 1, "customers_matched": 3, "customers_updated": 0, "snapshots_created": 1, "snapshots_skipped": 3, "snapshots_ineligible": 0}	\N	\N	2026-11-16 19:17:11.068166+07	2026-11-16 19:17:11.130307+07
454eda24-95dd-45f8-8529-0aea74e06f33	5d4b6121-7923-44b5-81d0-5503f965de0b	e4fe1c42-a2da-4d9f-a080-6f634c3aa1bc	1cfbd7a0-9107-4751-8e32-5b75de537a2e	f875323767be70399f09aa3ff36f2bf08eed197b091f8950d32558eab64dab2d	0900c0f39fbd1664380e0c370900ba0e9504569b82f9b1c476d674aeeb5316f3	completed	{"request_hash": "869b532647db3ec700ccb457a789606636889be087c7efac56755e7b4b9d7c25", "dataset_type": "behavior", "contract_version": "bulk-input-v1", "filename": "01.csv", "sources": ["kaggle-v1-bao-ve"], "mapping": {"Age": "Age", "Average_Order_Value": "Average_Order_Value", "Cart_Abandonment_Rate": "Cart_Abandonment_Rate", "Churned": "Churned", "City": "City", "Country": "Country", "Credit_Balance": "Credit_Balance", "Customer_Service_Calls": "Customer_Service_Calls", "Days_Since_Last_Purchase": "Days_Since_Last_Purchase", "Discount_Usage_Rate": "Discount_Usage_Rate", "Email_Open_Rate": "Email_Open_Rate", "Gender": "Gender", "Lifetime_Value": "Lifetime_Value", "Login_Frequency": "Login_Frequency", "Membership_Years": "Membership_Years", "Mobile_App_Usage": "Mobile_App_Usage", "Pages_Per_Session": "Pages_Per_Session", "Payment_Method_Diversity": "Payment_Method_Diversity", "Product_Reviews_Written": "Product_Reviews_Written", "Returns_Rate": "Returns_Rate", "Session_Duration_Avg": "Session_Duration_Avg", "Signup_Quarter": "Signup_Quarter", "Social_Media_Engagement_Score": "Social_Media_Engagement_Score", "Total_Purchases": "Total_Purchases", "Wishlist_Items": "Wishlist_Items", "captured_at": "captured_at", "external_id": "external_id", "source": "source"}, "profile": "snapshot", "accepted_partial": false, "acknowledge_import": true}	{"duplicate": 0, "error": 0, "skipped": 0, "snapshot_eligible": 12, "snapshot_ineligible": 0, "total": 12, "valid": 12, "warning": 12, "customers_created": 8, "customers_matched": 4, "customers_updated": 0, "snapshots_created": 8, "snapshots_skipped": 4, "snapshots_ineligible": 0}	\N	\N	2026-11-19 19:31:55.990884+07	2026-11-19 19:31:56.191363+07
21a1d4a6-dc73-4959-91a1-8379cd61ec88	5d4b6121-7923-44b5-81d0-5503f965de0b	37d3bec3-8da4-4274-a53a-86ed42e8b007	d6a91c60-9394-4eb8-9dc2-a2446ca5eb54	0dd681c27f271971645c2159eab827bad5a075b146cce82efcedc4e137e9fbd4	0900c0f39fbd1664380e0c370900ba0e9504569b82f9b1c476d674aeeb5316f3	completed	{"request_hash": "d778646b527ef7ee01f79603a8848e0a76c335a3bfa5894a5338c20076824893", "dataset_type": "behavior", "contract_version": "bulk-input-v1", "filename": "01.csv", "sources": ["kaggle-v1-bao-ve"], "mapping": {"Age": "Age", "Average_Order_Value": "Average_Order_Value", "Cart_Abandonment_Rate": "Cart_Abandonment_Rate", "Churned": "Churned", "City": "City", "Country": "Country", "Credit_Balance": "Credit_Balance", "Customer_Service_Calls": "Customer_Service_Calls", "Days_Since_Last_Purchase": "Days_Since_Last_Purchase", "Discount_Usage_Rate": "Discount_Usage_Rate", "Email_Open_Rate": "Email_Open_Rate", "Gender": "Gender", "Lifetime_Value": "Lifetime_Value", "Login_Frequency": "Login_Frequency", "Membership_Years": "Membership_Years", "Mobile_App_Usage": "Mobile_App_Usage", "Pages_Per_Session": "Pages_Per_Session", "Payment_Method_Diversity": "Payment_Method_Diversity", "Product_Reviews_Written": "Product_Reviews_Written", "Returns_Rate": "Returns_Rate", "Session_Duration_Avg": "Session_Duration_Avg", "Signup_Quarter": "Signup_Quarter", "Social_Media_Engagement_Score": "Social_Media_Engagement_Score", "Total_Purchases": "Total_Purchases", "Wishlist_Items": "Wishlist_Items", "captured_at": "captured_at", "external_id": "external_id", "source": "source"}, "profile": "snapshot", "accepted_partial": false, "acknowledge_import": true}	{"duplicate": 0, "error": 0, "skipped": 0, "snapshot_eligible": 12, "snapshot_ineligible": 0, "total": 12, "valid": 12, "warning": 12, "customers_created": 0, "customers_matched": 12, "customers_updated": 0, "snapshots_created": 0, "snapshots_skipped": 12, "snapshots_ineligible": 0}	\N	\N	2026-11-19 20:01:40.911817+07	2026-11-19 20:01:41.004621+07
f79a2e48-e9f3-4b96-b206-46b3eee6b46e	5d4b6121-7923-44b5-81d0-5503f965de0b	f192afbc-253a-46b0-b790-2d5eddabec13	d4eca299-5e1f-40f0-a66f-4b9fab789188	06451df00bf2082bec8d4cad431961c08d854dac81b5cee85cdc1bd4240b204f	ed951413a9d34d47bea06519424cdab4ffcd6caa7233ccc03b5fbdb488985260	completed	{"request_hash": "7acf0ebd88f9581cc720001c95467934bd79aa2d35ab99f8b1aadc8dc0669d9b", "dataset_type": "behavior", "contract_version": "bulk-input-v1", "filename": "02.csv", "sources": ["kaggle-v1-bao-ve"], "mapping": {"Age": "Age", "Average_Order_Value": "Average_Order_Value", "Cart_Abandonment_Rate": "Cart_Abandonment_Rate", "Churned": "Churned", "City": "City", "Country": "Country", "Credit_Balance": "Credit_Balance", "Customer_Service_Calls": "Customer_Service_Calls", "Days_Since_Last_Purchase": "Days_Since_Last_Purchase", "Discount_Usage_Rate": "Discount_Usage_Rate", "Email_Open_Rate": "Email_Open_Rate", "Gender": "Gender", "Lifetime_Value": "Lifetime_Value", "Login_Frequency": "Login_Frequency", "Membership_Years": "Membership_Years", "Mobile_App_Usage": "Mobile_App_Usage", "Pages_Per_Session": "Pages_Per_Session", "Payment_Method_Diversity": "Payment_Method_Diversity", "Product_Reviews_Written": "Product_Reviews_Written", "Returns_Rate": "Returns_Rate", "Session_Duration_Avg": "Session_Duration_Avg", "Signup_Quarter": "Signup_Quarter", "Social_Media_Engagement_Score": "Social_Media_Engagement_Score", "Total_Purchases": "Total_Purchases", "Wishlist_Items": "Wishlist_Items", "captured_at": "captured_at", "external_id": "external_id", "source": "source"}, "profile": "snapshot", "accepted_partial": true, "acknowledge_import": true}	{"duplicate": 0, "error": 2, "skipped": 0, "snapshot_eligible": 2, "snapshot_ineligible": 0, "total": 4, "valid": 2, "warning": 2, "customers_created": 2, "customers_matched": 0, "customers_updated": 0, "snapshots_created": 2, "snapshots_skipped": 0, "snapshots_ineligible": 0}	\N	\N	2026-11-20 18:12:22.771946+07	2026-11-20 18:12:22.893811+07
d4783698-ae56-4533-b6ce-bab50e68ca9b	5d4b6121-7923-44b5-81d0-5503f965de0b	f192afbc-253a-46b0-b790-2d5eddabec13	fb7705d6-6fc2-45b9-9577-ee0dfdbbc158	5a9b728c589c8567073840951dac29a0dbd113eed867af3ea15cd8f3da97194d	0900c0f39fbd1664380e0c370900ba0e9504569b82f9b1c476d674aeeb5316f3	completed	{"request_hash": "a3cf6965797e7dd2d8143dd198e8edcbbe6d722b93d4244a22b70adb04b66517", "dataset_type": "behavior", "contract_version": "bulk-input-v1", "filename": "01.csv", "sources": ["kaggle-v1-bao-ve"], "mapping": {"Age": "Age", "Average_Order_Value": "Average_Order_Value", "Cart_Abandonment_Rate": "Cart_Abandonment_Rate", "Churned": "Churned", "City": "City", "Country": "Country", "Credit_Balance": "Credit_Balance", "Customer_Service_Calls": "Customer_Service_Calls", "Days_Since_Last_Purchase": "Days_Since_Last_Purchase", "Discount_Usage_Rate": "Discount_Usage_Rate", "Email_Open_Rate": "Email_Open_Rate", "Gender": "Gender", "Lifetime_Value": "Lifetime_Value", "Login_Frequency": "Login_Frequency", "Membership_Years": "Membership_Years", "Mobile_App_Usage": "Mobile_App_Usage", "Pages_Per_Session": "Pages_Per_Session", "Payment_Method_Diversity": "Payment_Method_Diversity", "Product_Reviews_Written": "Product_Reviews_Written", "Returns_Rate": "Returns_Rate", "Session_Duration_Avg": "Session_Duration_Avg", "Signup_Quarter": "Signup_Quarter", "Social_Media_Engagement_Score": "Social_Media_Engagement_Score", "Total_Purchases": "Total_Purchases", "Wishlist_Items": "Wishlist_Items", "captured_at": "captured_at", "external_id": "external_id", "source": "source"}, "profile": "snapshot", "accepted_partial": false, "acknowledge_import": true}	{"duplicate": 0, "error": 0, "skipped": 0, "snapshot_eligible": 12, "snapshot_ineligible": 0, "total": 12, "valid": 12, "warning": 12, "customers_created": 0, "customers_matched": 12, "customers_updated": 0, "snapshots_created": 0, "snapshots_skipped": 12, "snapshots_ineligible": 0}	\N	\N	2026-11-20 18:13:00.66704+07	2026-11-20 18:13:00.758847+07
\.


--
-- Data for Name: bulk_import_rows; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.bulk_import_rows (id, job_id, row_number, row_key, snapshot_dedupe_key, content_hash, customer_id, snapshot_id, status, outcome) FROM stdin;
37a4b974-b595-4dc6-9c21-d2a64fd70847	87cef0f0-7e37-4f30-b802-e0a350539aea	2	d7594d80ebb8c26d325a9608b15d83206100c0048ae8f9f8f1f8ff2bd89ee570	d7594d80ebb8c26d325a9608b15d83206100c0048ae8f9f8f1f8ff2bd89ee570	6f253c93dc626ea8bd8a8773c34fab2c7a2ae11b1ce3438e8b11f38b65d88180	57f69d5a-454f-44dc-87e6-ceed37752554	4be8ac8a-8a3f-4fd6-9bf8-d0e212ea68e3	applied	{"identity": {"external_customer_id": "KAGGLE-V1-ROW-000001", "source_system": "kaggle-v1-demo"}, "customer_action": "created", "snapshot_action": "created", "missing_features": [], "input_data": {"Age": 43.0, "Average_Order_Value": 94.72, "Cart_Abandonment_Rate": 50.6, "Churned": 0.0, "City": "Marseille", "Country": "France", "Credit_Balance": 2278.0, "Customer_Service_Calls": 9.0, "Days_Since_Last_Purchase": 34.0, "Discount_Usage_Rate": 46.4, "Email_Open_Rate": 17.9, "Gender": "Male", "Lifetime_Value": 953.33, "Login_Frequency": 14.0, "Membership_Years": 2.9, "Mobile_App_Usage": 20.8, "Pages_Per_Session": 6.0, "Payment_Method_Diversity": 1.0, "Product_Reviews_Written": 4.0, "Returns_Rate": 2.0, "Session_Duration_Avg": 27.4, "Signup_Quarter": "Q1", "Social_Media_Engagement_Score": 16.3, "Total_Purchases": 9.0, "Wishlist_Items": 3.0, "captured_at": "2026-11-05T00:00:00Z", "currency": null, "external_id": "KAGGLE-V1-ROW-000001", "observation_end": null, "observation_start": null, "source": "kaggle-v1-demo"}, "provenance": "source_declared_not_certified"}
d24f064c-e2ca-4dda-a6c1-637f9247c3bf	87cef0f0-7e37-4f30-b802-e0a350539aea	3	7e679cf7cb3cc82fd3c3f4eb5c328eee463d775218bb94f220303f3e170f6aa5	7e679cf7cb3cc82fd3c3f4eb5c328eee463d775218bb94f220303f3e170f6aa5	81bd9f2f324ea894732677afc3015319b74dd5219166e15fc47834533a4ac81a	8162c657-ebf3-47d3-82c4-311a988bfb5c	d29947f1-3535-4d4f-9c3d-18497bc688b0	applied	{"identity": {"external_customer_id": "KAGGLE-V1-ROW-000004", "source_system": "kaggle-v1-demo"}, "customer_action": "created", "snapshot_action": "created", "missing_features": [], "input_data": {"Age": 56.0, "Average_Order_Value": 147.33, "Cart_Abandonment_Rate": 41.7, "Churned": 0.0, "City": "New York", "Country": "USA", "Credit_Balance": 2674.0, "Customer_Service_Calls": 2.0, "Days_Since_Last_Purchase": 47.0, "Discount_Usage_Rate": 44.1, "Email_Open_Rate": 41.4, "Gender": "Female", "Lifetime_Value": 2340.92, "Login_Frequency": 10.0, "Membership_Years": 2.6, "Mobile_App_Usage": 31.0, "Pages_Per_Session": 14.8, "Payment_Method_Diversity": 3.0, "Product_Reviews_Written": 5.0, "Returns_Rate": 5.4, "Session_Duration_Avg": 38.4, "Signup_Quarter": "Q1", "Social_Media_Engagement_Score": 85.9, "Total_Purchases": 15.0, "Wishlist_Items": 9.0, "captured_at": "2026-11-05T00:00:00Z", "currency": null, "external_id": "KAGGLE-V1-ROW-000004", "observation_end": null, "observation_start": null, "source": "kaggle-v1-demo"}, "provenance": "source_declared_not_certified"}
3fe5bda4-a9ca-4477-a1e5-3c84b23901ef	87cef0f0-7e37-4f30-b802-e0a350539aea	4	6bc47c11b5e7cbade08531635bf62773bd681b29161e281162190b893a0266c6	6bc47c11b5e7cbade08531635bf62773bd681b29161e281162190b893a0266c6	bc99d914ac8300bd57c5ec6ba5f908ce4e52f521acd195f3d0e93aca8df5b701	dd4e4b7a-6abc-4f13-9248-5a97d610173d	c856127a-ada0-4519-8f49-0e0698fa3111	applied	{"identity": {"external_customer_id": "KAGGLE-V1-ROW-000006", "source_system": "kaggle-v1-demo"}, "customer_action": "created", "snapshot_action": "created", "missing_features": [], "input_data": {"Age": 35.0, "Average_Order_Value": 190.97, "Cart_Abandonment_Rate": 74.4, "Churned": 1.0, "City": "Tokyo", "Country": "Japan", "Credit_Balance": 2418.0, "Customer_Service_Calls": 8.0, "Days_Since_Last_Purchase": 29.0, "Discount_Usage_Rate": 60.2, "Email_Open_Rate": 16.0, "Gender": "Male", "Lifetime_Value": 1995.43, "Login_Frequency": 6.0, "Membership_Years": 3.5, "Mobile_App_Usage": 11.2, "Pages_Per_Session": 6.9, "Payment_Method_Diversity": 2.0, "Product_Reviews_Written": 2.0, "Returns_Rate": 11.0, "Session_Duration_Avg": 21.9, "Signup_Quarter": "Q1", "Social_Media_Engagement_Score": 14.3, "Total_Purchases": 12.0, "Wishlist_Items": 0.0, "captured_at": "2026-11-05T00:00:00Z", "currency": null, "external_id": "KAGGLE-V1-ROW-000006", "observation_end": null, "observation_start": null, "source": "kaggle-v1-demo"}, "provenance": "source_declared_not_certified"}
4efe5767-042c-4e88-9e08-6a1b00bab6c0	87cef0f0-7e37-4f30-b802-e0a350539aea	5	a2389d21b686e19fd48d1ff867dadbbcbc51fb4de35310329ab4715d88f21422	a2389d21b686e19fd48d1ff867dadbbcbc51fb4de35310329ab4715d88f21422	10e42e304ddca6bda1e94b10fe8dab62b135271aaf381ae7c4020b65c67bde3e	5296c492-d639-49b2-b079-ffd975e6fede	fcbf66a3-0563-4767-a279-3b75f0ae4a3e	applied	{"identity": {"external_customer_id": "KAGGLE-V1-ROW-000007", "source_system": "kaggle-v1-demo"}, "customer_action": "created", "snapshot_action": "created", "missing_features": [], "input_data": {"Age": 56.0, "Average_Order_Value": 169.58, "Cart_Abandonment_Rate": 36.2, "Churned": 0.0, "City": "Berlin", "Country": "Germany", "Credit_Balance": 2657.0, "Customer_Service_Calls": 4.0, "Days_Since_Last_Purchase": 10.0, "Discount_Usage_Rate": 27.8, "Email_Open_Rate": 35.5, "Gender": "Male", "Lifetime_Value": 3003.57, "Login_Frequency": 24.0, "Membership_Years": 1.9, "Mobile_App_Usage": 42.9, "Pages_Per_Session": 13.9, "Payment_Method_Diversity": 5.0, "Product_Reviews_Written": 6.0, "Returns_Rate": 5.5, "Session_Duration_Avg": 46.4, "Signup_Quarter": "Q1", "Social_Media_Engagement_Score": 68.8, "Total_Purchases": 20.0, "Wishlist_Items": 5.0, "captured_at": "2026-11-05T00:00:00Z", "currency": null, "external_id": "KAGGLE-V1-ROW-000007", "observation_end": null, "observation_start": null, "source": "kaggle-v1-demo"}, "provenance": "source_declared_not_certified"}
1d45418c-c1ca-4b32-8127-dd7834678c72	87cef0f0-7e37-4f30-b802-e0a350539aea	6	de0f39d8a7ecb942ce06260b8923fe28cd86c8a970ec45f0a5043b3f598842f7	de0f39d8a7ecb942ce06260b8923fe28cd86c8a970ec45f0a5043b3f598842f7	82dd37f71744094b243926404593e9b7ead15bcc44fa49073c30a4b58d842395	160f6589-9281-4c66-9e34-5e34d959e368	aceae448-736d-4822-a224-149441d67c08	applied	{"identity": {"external_customer_id": "KAGGLE-V1-ROW-000011", "source_system": "kaggle-v1-demo"}, "customer_action": "created", "snapshot_action": "created", "missing_features": [], "input_data": {"Age": 32.0, "Average_Order_Value": 118.0, "Cart_Abandonment_Rate": 73.5, "Churned": 1.0, "City": "Glasgow", "Country": "UK", "Credit_Balance": 498.0, "Customer_Service_Calls": 11.0, "Days_Since_Last_Purchase": 23.0, "Discount_Usage_Rate": 46.2, "Email_Open_Rate": 0.0, "Gender": "Male", "Lifetime_Value": 599.41, "Login_Frequency": 0.0, "Membership_Years": 0.9, "Mobile_App_Usage": 8.0, "Pages_Per_Session": 2.9, "Payment_Method_Diversity": 1.0, "Product_Reviews_Written": 2.0, "Returns_Rate": 5.1, "Session_Duration_Avg": 12.3, "Signup_Quarter": "Q2", "Social_Media_Engagement_Score": 17.0, "Total_Purchases": 5.0, "Wishlist_Items": 0.0, "captured_at": "2026-11-05T00:00:00Z", "currency": null, "external_id": "KAGGLE-V1-ROW-000011", "observation_end": null, "observation_start": null, "source": "kaggle-v1-demo"}, "provenance": "source_declared_not_certified"}
1d57024b-5f70-4f91-98b4-511b94afe4ce	87cef0f0-7e37-4f30-b802-e0a350539aea	7	65fc8f285756df3df92dcfc4bafa88b9af3890562f632acf6a8dbfd8537892dc	65fc8f285756df3df92dcfc4bafa88b9af3890562f632acf6a8dbfd8537892dc	8b061d4d5938c2510ea2e3324cc2b80f81eb837d2df690fc7b187644b6e5905d	2f53e95b-d728-4eb3-a08e-a0b9525c3ca2	659f1dda-79b9-4971-9f4c-ffe36f9acb38	applied	{"identity": {"external_customer_id": "KAGGLE-V1-ROW-000012", "source_system": "kaggle-v1-demo"}, "customer_action": "created", "snapshot_action": "created", "missing_features": [], "input_data": {"Age": 32.0, "Average_Order_Value": 78.88, "Cart_Abandonment_Rate": 77.2, "Churned": 1.0, "City": "Munich", "Country": "Germany", "Credit_Balance": 1369.0, "Customer_Service_Calls": 7.0, "Days_Since_Last_Purchase": 36.0, "Discount_Usage_Rate": 72.0, "Email_Open_Rate": 4.0, "Gender": "Female", "Lifetime_Value": 335.92, "Login_Frequency": 11.0, "Membership_Years": 0.6, "Mobile_App_Usage": 17.7, "Pages_Per_Session": 5.6, "Payment_Method_Diversity": 2.0, "Product_Reviews_Written": 1.0, "Returns_Rate": 4.8, "Session_Duration_Avg": 12.1, "Signup_Quarter": "Q3", "Social_Media_Engagement_Score": 0.0, "Total_Purchases": 5.0, "Wishlist_Items": 0.0, "captured_at": "2026-11-05T00:00:00Z", "currency": null, "external_id": "KAGGLE-V1-ROW-000012", "observation_end": null, "observation_start": null, "source": "kaggle-v1-demo"}, "provenance": "source_declared_not_certified"}
452d9424-dc28-4c74-9f76-b5e417852c2b	87cef0f0-7e37-4f30-b802-e0a350539aea	8	87bad0921d31f0d3636126db09e7e21a9875f61fdba59fe762714bde4c39dbd6	87bad0921d31f0d3636126db09e7e21a9875f61fdba59fe762714bde4c39dbd6	ca037b1429882b8d8ae57ed653f233935e9eac8869ec749e9a8d2a5860f9bf2c	163739c8-fa6b-4787-9998-ee64f036abb0	41983682-1ec7-4897-a67e-54c50942bf28	applied	{"identity": {"external_customer_id": "KAGGLE-V1-ROW-000015", "source_system": "kaggle-v1-demo"}, "customer_action": "created", "snapshot_action": "created", "missing_features": [], "input_data": {"Age": 18.0, "Average_Order_Value": 123.0, "Cart_Abandonment_Rate": 48.4, "Churned": 0.0, "City": "Paris", "Country": "France", "Credit_Balance": 3624.0, "Customer_Service_Calls": 6.0, "Days_Since_Last_Purchase": 8.0, "Discount_Usage_Rate": 40.0, "Email_Open_Rate": 16.1, "Gender": "Female", "Lifetime_Value": 1618.51, "Login_Frequency": 14.0, "Membership_Years": 3.7, "Mobile_App_Usage": 23.3, "Pages_Per_Session": 10.3, "Payment_Method_Diversity": 3.0, "Product_Reviews_Written": 4.0, "Returns_Rate": 3.7, "Session_Duration_Avg": 33.5, "Signup_Quarter": "Q1", "Social_Media_Engagement_Score": 28.3, "Total_Purchases": 15.0, "Wishlist_Items": 2.0, "captured_at": "2026-11-05T00:00:00Z", "currency": null, "external_id": "KAGGLE-V1-ROW-000015", "observation_end": null, "observation_start": null, "source": "kaggle-v1-demo"}, "provenance": "source_declared_not_certified"}
605d605d-657d-441d-b0ef-3563f93651d8	87cef0f0-7e37-4f30-b802-e0a350539aea	9	feaf466d1265f55736522caffe0c59649cb5c50c2ce66da16ac65ea9f44946fc	feaf466d1265f55736522caffe0c59649cb5c50c2ce66da16ac65ea9f44946fc	1f9b55f21ac6be2ceee3b4f641c4a4031d3dbd185b31eca71760b6631064ff07	e7cab491-86a0-487f-b40e-5e5b6d6b2c5d	efdea114-ea80-4b5c-94d2-0590544d3ea0	applied	{"identity": {"external_customer_id": "KAGGLE-V1-ROW-000016", "source_system": "kaggle-v1-demo"}, "customer_action": "created", "snapshot_action": "created", "missing_features": [], "input_data": {"Age": 31.0, "Average_Order_Value": 91.92, "Cart_Abandonment_Rate": 44.0, "Churned": 0.0, "City": "New York", "Country": "USA", "Credit_Balance": 2564.0, "Customer_Service_Calls": 4.0, "Days_Since_Last_Purchase": 55.0, "Discount_Usage_Rate": 83.8, "Email_Open_Rate": 45.0, "Gender": "Female", "Lifetime_Value": 1692.54, "Login_Frequency": 24.0, "Membership_Years": 1.4, "Mobile_App_Usage": 26.5, "Pages_Per_Session": 18.0, "Payment_Method_Diversity": 1.0, "Product_Reviews_Written": 5.0, "Returns_Rate": 2.5, "Session_Duration_Avg": 50.8, "Signup_Quarter": "Q3", "Social_Media_Engagement_Score": 81.6, "Total_Purchases": 18.0, "Wishlist_Items": 5.0, "captured_at": "2026-11-05T00:00:00Z", "currency": null, "external_id": "KAGGLE-V1-ROW-000016", "observation_end": null, "observation_start": null, "source": "kaggle-v1-demo"}, "provenance": "source_declared_not_certified"}
3b5b59dc-3f98-43a8-8cce-74cf2eb0978f	87cef0f0-7e37-4f30-b802-e0a350539aea	10	7aaf012392ae8d9378cc4ed6d489a286fc56c992f63218ba513619ce6f3f530b	7aaf012392ae8d9378cc4ed6d489a286fc56c992f63218ba513619ce6f3f530b	7889c35d7a2f4251bde62f86a378aee9a6b52e41b1d16f556092ac795cd11250	4efac273-318c-4742-b381-e07a7d4d63d0	ee6ad2c4-a96e-4ea9-afb5-bb039b1c2629	applied	{"identity": {"external_customer_id": "KAGGLE-V1-ROW-000017", "source_system": "kaggle-v1-demo"}, "customer_action": "created", "snapshot_action": "created", "missing_features": [], "input_data": {"Age": 25.0, "Average_Order_Value": 116.39, "Cart_Abandonment_Rate": 68.5, "Churned": 0.0, "City": "Ottawa", "Country": "Canada", "Credit_Balance": 1048.0, "Customer_Service_Calls": 9.0, "Days_Since_Last_Purchase": 78.0, "Discount_Usage_Rate": 42.6, "Email_Open_Rate": 0.0, "Gender": "Female", "Lifetime_Value": 503.26, "Login_Frequency": 4.0, "Membership_Years": 0.9, "Mobile_App_Usage": 15.5, "Pages_Per_Session": 3.7, "Payment_Method_Diversity": 1.0, "Product_Reviews_Written": 1.0, "Returns_Rate": 7.0, "Session_Duration_Avg": 12.4, "Signup_Quarter": "Q3", "Social_Media_Engagement_Score": 0.0, "Total_Purchases": 4.0, "Wishlist_Items": 1.0, "captured_at": "2026-11-05T00:00:00Z", "currency": null, "external_id": "KAGGLE-V1-ROW-000017", "observation_end": null, "observation_start": null, "source": "kaggle-v1-demo"}, "provenance": "source_declared_not_certified"}
108db661-f1ba-4bc9-bd0a-85fdabbaafe9	87cef0f0-7e37-4f30-b802-e0a350539aea	11	9f6cbf83fa208257389de95f94e18f7cc9afe3b8115f13768dbdb88eb8d4fa11	9f6cbf83fa208257389de95f94e18f7cc9afe3b8115f13768dbdb88eb8d4fa11	d760622d0617be81b39237366e8cd9714da04d2c0ded4f48b5035d6fd08f4535	e1152b08-1d0a-42b5-b820-542c6a1be3bb	8132853b-d363-452e-802b-c33606f6c154	applied	{"identity": {"external_customer_id": "KAGGLE-V1-ROW-000019", "source_system": "kaggle-v1-demo"}, "customer_action": "created", "snapshot_action": "created", "missing_features": [], "input_data": {"Age": 27.0, "Average_Order_Value": 103.12, "Cart_Abandonment_Rate": 59.8, "Churned": 0.0, "City": "Bangalore", "Country": "India", "Credit_Balance": 54.0, "Customer_Service_Calls": 4.0, "Days_Since_Last_Purchase": 5.0, "Discount_Usage_Rate": 6.5, "Email_Open_Rate": 12.5, "Gender": "Female", "Lifetime_Value": 1096.88, "Login_Frequency": 0.0, "Membership_Years": 2.0, "Mobile_App_Usage": 17.5, "Pages_Per_Session": 9.8, "Payment_Method_Diversity": 3.0, "Product_Reviews_Written": 0.0, "Returns_Rate": 18.6, "Session_Duration_Avg": 20.3, "Signup_Quarter": "Q2", "Social_Media_Engagement_Score": 3.4, "Total_Purchases": 11.0, "Wishlist_Items": 2.0, "captured_at": "2026-11-05T00:00:00Z", "currency": null, "external_id": "KAGGLE-V1-ROW-000019", "observation_end": null, "observation_start": null, "source": "kaggle-v1-demo"}, "provenance": "source_declared_not_certified"}
844854ee-d09a-483c-b0e0-d057c87b01ea	ca6f8676-4928-42aa-b592-3e3f0932f10a	2	0b4479d5bea4ed0d3f047c21be356bb144af61058936a4343505f7a9d41c73e1	0b4479d5bea4ed0d3f047c21be356bb144af61058936a4343505f7a9d41c73e1	dc3b99876aae983c0e3b30462f5b49ba3707da0a362e9895eb9096cca2cab616	727ec9c1-79ad-4c07-acfe-8daf9690fb2c	3ea17821-fe0c-467b-8ee4-d8a1716c8db4	applied	{"identity": {"external_customer_id": "BAOVE-001", "source_system": "kaggle-v1-bao-ve"}, "customer_action": "created", "snapshot_action": "created", "missing_features": [], "input_data": {"Age": 56.0, "Average_Order_Value": 147.33, "Cart_Abandonment_Rate": 41.7, "Churned": 0.0, "City": "New York", "Country": "USA", "Credit_Balance": 2674.0, "Customer_Service_Calls": 2.0, "Days_Since_Last_Purchase": 47.0, "Discount_Usage_Rate": 44.1, "Email_Open_Rate": 41.4, "Gender": "Female", "Lifetime_Value": 2340.92, "Login_Frequency": 10.0, "Membership_Years": 2.6, "Mobile_App_Usage": 31.0, "Pages_Per_Session": 14.8, "Payment_Method_Diversity": 3.0, "Product_Reviews_Written": 5.0, "Returns_Rate": 5.4, "Session_Duration_Avg": 38.4, "Signup_Quarter": "Q1", "Social_Media_Engagement_Score": 85.9, "Total_Purchases": 15.0, "Wishlist_Items": 9.0, "captured_at": "2026-11-15T00:00:00Z", "currency": null, "external_id": "BAOVE-001", "observation_end": null, "observation_start": null, "source": "kaggle-v1-bao-ve"}, "provenance": "source_declared_not_certified"}
c82e3237-9e1e-4c7f-ba7f-2355ef37e5cd	ca6f8676-4928-42aa-b592-3e3f0932f10a	3	92c76b0ffe560d6f8faa2a638c7086a9c074c92738cb296a58756b8e99baacf1	92c76b0ffe560d6f8faa2a638c7086a9c074c92738cb296a58756b8e99baacf1	a63f1b5d5d69506139ea25f4a638b188fcde92c7726a3b7f27c77bd7afaa208b	ca7c6bc9-5e44-424f-8fe2-75c5b00201a0	a06ed6d7-559b-4f15-ba70-719f1a96648d	applied	{"identity": {"external_customer_id": "BAOVE-002", "source_system": "kaggle-v1-bao-ve"}, "customer_action": "created", "snapshot_action": "created", "missing_features": [], "input_data": {"Age": 55.0, "Average_Order_Value": 108.52, "Cart_Abandonment_Rate": 25.2, "Churned": 0.0, "City": "Bangalore", "Country": "India", "Credit_Balance": 4561.0, "Customer_Service_Calls": 1.0, "Days_Since_Last_Purchase": 4.0, "Discount_Usage_Rate": 33.0, "Email_Open_Rate": 72.1, "Gender": "Female", "Lifetime_Value": 3063.29, "Login_Frequency": 24.0, "Membership_Years": 1.2, "Mobile_App_Usage": 37.8, "Pages_Per_Session": 16.0, "Payment_Method_Diversity": 1.0, "Product_Reviews_Written": 5.0, "Returns_Rate": 11.6, "Session_Duration_Avg": 50.3, "Signup_Quarter": "Q1", "Social_Media_Engagement_Score": 76.7, "Total_Purchases": 24.0, "Wishlist_Items": 9.0, "captured_at": "2026-11-15T00:00:00Z", "currency": null, "external_id": "BAOVE-002", "observation_end": null, "observation_start": null, "source": "kaggle-v1-bao-ve"}, "provenance": "source_declared_not_certified"}
1f63ace3-adaa-4b49-b90e-15a5bd67abb9	ca6f8676-4928-42aa-b592-3e3f0932f10a	4	7862236d9d91f67cc46160123dbeb8683f54223f8993c2db9c58ccbf49bfb74a	7862236d9d91f67cc46160123dbeb8683f54223f8993c2db9c58ccbf49bfb74a	3ab3a3f7b356fba3a128709450adc65df7f1074398d188a8bb23592ecbfb75a9	0a9ab69a-3e34-41bd-91bd-2ff1a9611e13	32464d68-d517-4fda-9cdb-e04204f8efe9	applied	{"identity": {"external_customer_id": "BAOVE-003", "source_system": "kaggle-v1-bao-ve"}, "customer_action": "created", "snapshot_action": "created", "missing_features": [], "input_data": {"Age": 34.0, "Average_Order_Value": 65.22, "Cart_Abandonment_Rate": 38.3, "Churned": 0.0, "City": "Yokohama", "Country": "Japan", "Credit_Balance": 1889.0, "Customer_Service_Calls": 1.0, "Days_Since_Last_Purchase": 10.0, "Discount_Usage_Rate": 32.3, "Email_Open_Rate": 23.8, "Gender": "Male", "Lifetime_Value": 1226.33, "Login_Frequency": 12.0, "Membership_Years": 4.4, "Mobile_App_Usage": 28.8, "Pages_Per_Session": 13.3, "Payment_Method_Diversity": 2.0, "Product_Reviews_Written": 2.0, "Returns_Rate": 5.9, "Session_Duration_Avg": 42.1, "Signup_Quarter": "Q3", "Social_Media_Engagement_Score": 38.8, "Total_Purchases": 17.0, "Wishlist_Items": 8.0, "captured_at": "2026-11-15T00:00:00Z", "currency": null, "external_id": "BAOVE-003", "observation_end": null, "observation_start": null, "source": "kaggle-v1-bao-ve"}, "provenance": "source_declared_not_certified"}
97f44eff-981e-4a4c-82b5-45d11e6dacca	d3a33009-7f67-4ada-a769-9adc7ab987a6	2	0b4479d5bea4ed0d3f047c21be356bb144af61058936a4343505f7a9d41c73e1	\N	dc3b99876aae983c0e3b30462f5b49ba3707da0a362e9895eb9096cca2cab616	727ec9c1-79ad-4c07-acfe-8daf9690fb2c	3ea17821-fe0c-467b-8ee4-d8a1716c8db4	applied	{"identity": {"external_customer_id": "BAOVE-001", "source_system": "kaggle-v1-bao-ve"}, "customer_action": "matched", "snapshot_action": "reused", "missing_features": [], "input_data": {"Age": 56.0, "Average_Order_Value": 147.33, "Cart_Abandonment_Rate": 41.7, "Churned": 0.0, "City": "New York", "Country": "USA", "Credit_Balance": 2674.0, "Customer_Service_Calls": 2.0, "Days_Since_Last_Purchase": 47.0, "Discount_Usage_Rate": 44.1, "Email_Open_Rate": 41.4, "Gender": "Female", "Lifetime_Value": 2340.92, "Login_Frequency": 10.0, "Membership_Years": 2.6, "Mobile_App_Usage": 31.0, "Pages_Per_Session": 14.8, "Payment_Method_Diversity": 3.0, "Product_Reviews_Written": 5.0, "Returns_Rate": 5.4, "Session_Duration_Avg": 38.4, "Signup_Quarter": "Q1", "Social_Media_Engagement_Score": 85.9, "Total_Purchases": 15.0, "Wishlist_Items": 9.0, "captured_at": "2026-11-15T00:00:00Z", "currency": null, "external_id": "BAOVE-001", "observation_end": null, "observation_start": null, "source": "kaggle-v1-bao-ve"}, "provenance": "source_declared_not_certified"}
2d8668b3-8ecd-4f7e-914b-406ddf809b70	d3a33009-7f67-4ada-a769-9adc7ab987a6	3	92c76b0ffe560d6f8faa2a638c7086a9c074c92738cb296a58756b8e99baacf1	\N	a63f1b5d5d69506139ea25f4a638b188fcde92c7726a3b7f27c77bd7afaa208b	ca7c6bc9-5e44-424f-8fe2-75c5b00201a0	a06ed6d7-559b-4f15-ba70-719f1a96648d	applied	{"identity": {"external_customer_id": "BAOVE-002", "source_system": "kaggle-v1-bao-ve"}, "customer_action": "matched", "snapshot_action": "reused", "missing_features": [], "input_data": {"Age": 55.0, "Average_Order_Value": 108.52, "Cart_Abandonment_Rate": 25.2, "Churned": 0.0, "City": "Bangalore", "Country": "India", "Credit_Balance": 4561.0, "Customer_Service_Calls": 1.0, "Days_Since_Last_Purchase": 4.0, "Discount_Usage_Rate": 33.0, "Email_Open_Rate": 72.1, "Gender": "Female", "Lifetime_Value": 3063.29, "Login_Frequency": 24.0, "Membership_Years": 1.2, "Mobile_App_Usage": 37.8, "Pages_Per_Session": 16.0, "Payment_Method_Diversity": 1.0, "Product_Reviews_Written": 5.0, "Returns_Rate": 11.6, "Session_Duration_Avg": 50.3, "Signup_Quarter": "Q1", "Social_Media_Engagement_Score": 76.7, "Total_Purchases": 24.0, "Wishlist_Items": 9.0, "captured_at": "2026-11-15T00:00:00Z", "currency": null, "external_id": "BAOVE-002", "observation_end": null, "observation_start": null, "source": "kaggle-v1-bao-ve"}, "provenance": "source_declared_not_certified"}
4b565635-a655-4582-9609-f0f83b62b8a0	d3a33009-7f67-4ada-a769-9adc7ab987a6	4	7862236d9d91f67cc46160123dbeb8683f54223f8993c2db9c58ccbf49bfb74a	\N	3ab3a3f7b356fba3a128709450adc65df7f1074398d188a8bb23592ecbfb75a9	0a9ab69a-3e34-41bd-91bd-2ff1a9611e13	32464d68-d517-4fda-9cdb-e04204f8efe9	applied	{"identity": {"external_customer_id": "BAOVE-003", "source_system": "kaggle-v1-bao-ve"}, "customer_action": "matched", "snapshot_action": "reused", "missing_features": [], "input_data": {"Age": 34.0, "Average_Order_Value": 65.22, "Cart_Abandonment_Rate": 38.3, "Churned": 0.0, "City": "Yokohama", "Country": "Japan", "Credit_Balance": 1889.0, "Customer_Service_Calls": 1.0, "Days_Since_Last_Purchase": 10.0, "Discount_Usage_Rate": 32.3, "Email_Open_Rate": 23.8, "Gender": "Male", "Lifetime_Value": 1226.33, "Login_Frequency": 12.0, "Membership_Years": 4.4, "Mobile_App_Usage": 28.8, "Pages_Per_Session": 13.3, "Payment_Method_Diversity": 2.0, "Product_Reviews_Written": 2.0, "Returns_Rate": 5.9, "Session_Duration_Avg": 42.1, "Signup_Quarter": "Q3", "Social_Media_Engagement_Score": 38.8, "Total_Purchases": 17.0, "Wishlist_Items": 8.0, "captured_at": "2026-11-15T00:00:00Z", "currency": null, "external_id": "BAOVE-003", "observation_end": null, "observation_start": null, "source": "kaggle-v1-bao-ve"}, "provenance": "source_declared_not_certified"}
6f7d387e-2ffb-4a89-9610-5ee78e880f15	d3a33009-7f67-4ada-a769-9adc7ab987a6	5	096408282839d4f959b0cddf1e6acc4ec5299b6e7d115b8538081aff90245de4	096408282839d4f959b0cddf1e6acc4ec5299b6e7d115b8538081aff90245de4	ed0a4fe96c663828d8535e240616562ec5df65e8a5d556798beb0114a19862af	31c63922-7346-414c-8346-deae09984763	71a3fc19-abba-49d9-a693-c3acaed40168	applied	{"identity": {"external_customer_id": "BAOVE-008", "source_system": "kaggle-v1-bao-ve"}, "customer_action": "created", "snapshot_action": "created", "missing_features": [], "input_data": {"Age": 42.0, "Average_Order_Value": 150.38, "Cart_Abandonment_Rate": 62.5, "Churned": 0.0, "City": "Chicago", "Country": "USA", "Credit_Balance": 2656.0, "Customer_Service_Calls": 2.0, "Days_Since_Last_Purchase": 24.0, "Discount_Usage_Rate": 71.3, "Email_Open_Rate": 23.3, "Gender": "Male", "Lifetime_Value": 1345.57, "Login_Frequency": 7.0, "Membership_Years": 3.4, "Mobile_App_Usage": 18.9, "Pages_Per_Session": 12.2, "Payment_Method_Diversity": 2.0, "Product_Reviews_Written": 2.0, "Returns_Rate": 7.0, "Session_Duration_Avg": 25.9, "Signup_Quarter": "Q2", "Social_Media_Engagement_Score": 4.7, "Total_Purchases": 10.0, "Wishlist_Items": 4.0, "captured_at": "2026-11-15T00:00:00Z", "currency": null, "external_id": "BAOVE-008", "observation_end": null, "observation_start": null, "source": "kaggle-v1-bao-ve"}, "provenance": "source_declared_not_certified"}
f9b54d37-6bbf-41e6-aca1-507066af1a09	454eda24-95dd-45f8-8529-0aea74e06f33	2	0b4479d5bea4ed0d3f047c21be356bb144af61058936a4343505f7a9d41c73e1	\N	dc3b99876aae983c0e3b30462f5b49ba3707da0a362e9895eb9096cca2cab616	727ec9c1-79ad-4c07-acfe-8daf9690fb2c	3ea17821-fe0c-467b-8ee4-d8a1716c8db4	applied	{"identity": {"external_customer_id": "BAOVE-001", "source_system": "kaggle-v1-bao-ve"}, "customer_action": "matched", "snapshot_action": "reused", "missing_features": [], "input_data": {"Age": 56.0, "Average_Order_Value": 147.33, "Cart_Abandonment_Rate": 41.7, "Churned": 0.0, "City": "New York", "Country": "USA", "Credit_Balance": 2674.0, "Customer_Service_Calls": 2.0, "Days_Since_Last_Purchase": 47.0, "Discount_Usage_Rate": 44.1, "Email_Open_Rate": 41.4, "Gender": "Female", "Lifetime_Value": 2340.92, "Login_Frequency": 10.0, "Membership_Years": 2.6, "Mobile_App_Usage": 31.0, "Pages_Per_Session": 14.8, "Payment_Method_Diversity": 3.0, "Product_Reviews_Written": 5.0, "Returns_Rate": 5.4, "Session_Duration_Avg": 38.4, "Signup_Quarter": "Q1", "Social_Media_Engagement_Score": 85.9, "Total_Purchases": 15.0, "Wishlist_Items": 9.0, "captured_at": "2026-11-15T00:00:00Z", "currency": null, "external_id": "BAOVE-001", "observation_end": null, "observation_start": null, "source": "kaggle-v1-bao-ve"}, "provenance": "source_declared_not_certified"}
8e6ea489-f111-4678-b495-f49c50aa5914	454eda24-95dd-45f8-8529-0aea74e06f33	3	92c76b0ffe560d6f8faa2a638c7086a9c074c92738cb296a58756b8e99baacf1	\N	a63f1b5d5d69506139ea25f4a638b188fcde92c7726a3b7f27c77bd7afaa208b	ca7c6bc9-5e44-424f-8fe2-75c5b00201a0	a06ed6d7-559b-4f15-ba70-719f1a96648d	applied	{"identity": {"external_customer_id": "BAOVE-002", "source_system": "kaggle-v1-bao-ve"}, "customer_action": "matched", "snapshot_action": "reused", "missing_features": [], "input_data": {"Age": 55.0, "Average_Order_Value": 108.52, "Cart_Abandonment_Rate": 25.2, "Churned": 0.0, "City": "Bangalore", "Country": "India", "Credit_Balance": 4561.0, "Customer_Service_Calls": 1.0, "Days_Since_Last_Purchase": 4.0, "Discount_Usage_Rate": 33.0, "Email_Open_Rate": 72.1, "Gender": "Female", "Lifetime_Value": 3063.29, "Login_Frequency": 24.0, "Membership_Years": 1.2, "Mobile_App_Usage": 37.8, "Pages_Per_Session": 16.0, "Payment_Method_Diversity": 1.0, "Product_Reviews_Written": 5.0, "Returns_Rate": 11.6, "Session_Duration_Avg": 50.3, "Signup_Quarter": "Q1", "Social_Media_Engagement_Score": 76.7, "Total_Purchases": 24.0, "Wishlist_Items": 9.0, "captured_at": "2026-11-15T00:00:00Z", "currency": null, "external_id": "BAOVE-002", "observation_end": null, "observation_start": null, "source": "kaggle-v1-bao-ve"}, "provenance": "source_declared_not_certified"}
0122c543-c217-489f-b4dc-faa25bdefd77	454eda24-95dd-45f8-8529-0aea74e06f33	4	7862236d9d91f67cc46160123dbeb8683f54223f8993c2db9c58ccbf49bfb74a	\N	3ab3a3f7b356fba3a128709450adc65df7f1074398d188a8bb23592ecbfb75a9	0a9ab69a-3e34-41bd-91bd-2ff1a9611e13	32464d68-d517-4fda-9cdb-e04204f8efe9	applied	{"identity": {"external_customer_id": "BAOVE-003", "source_system": "kaggle-v1-bao-ve"}, "customer_action": "matched", "snapshot_action": "reused", "missing_features": [], "input_data": {"Age": 34.0, "Average_Order_Value": 65.22, "Cart_Abandonment_Rate": 38.3, "Churned": 0.0, "City": "Yokohama", "Country": "Japan", "Credit_Balance": 1889.0, "Customer_Service_Calls": 1.0, "Days_Since_Last_Purchase": 10.0, "Discount_Usage_Rate": 32.3, "Email_Open_Rate": 23.8, "Gender": "Male", "Lifetime_Value": 1226.33, "Login_Frequency": 12.0, "Membership_Years": 4.4, "Mobile_App_Usage": 28.8, "Pages_Per_Session": 13.3, "Payment_Method_Diversity": 2.0, "Product_Reviews_Written": 2.0, "Returns_Rate": 5.9, "Session_Duration_Avg": 42.1, "Signup_Quarter": "Q3", "Social_Media_Engagement_Score": 38.8, "Total_Purchases": 17.0, "Wishlist_Items": 8.0, "captured_at": "2026-11-15T00:00:00Z", "currency": null, "external_id": "BAOVE-003", "observation_end": null, "observation_start": null, "source": "kaggle-v1-bao-ve"}, "provenance": "source_declared_not_certified"}
bb75041d-aa46-45ac-a2fc-4ba9af9e6653	454eda24-95dd-45f8-8529-0aea74e06f33	5	7092b04bd61ae246236f624f99f4a58b75e22a916cad72d33047cb4f7b2ffe0e	7092b04bd61ae246236f624f99f4a58b75e22a916cad72d33047cb4f7b2ffe0e	cd459b3041ef6d93b085c0c259fa6392967af0daddd52cdbc6bcd9e301702661	946fe89f-61ca-41a3-b193-878471e439c2	fdf9215b-960a-44d3-98f9-6683a2c590f7	applied	{"identity": {"external_customer_id": "BAOVE-004", "source_system": "kaggle-v1-bao-ve"}, "customer_action": "created", "snapshot_action": "created", "missing_features": [], "input_data": {"Age": 37.0, "Average_Order_Value": 134.1, "Cart_Abandonment_Rate": 27.8, "Churned": 1.0, "City": "Munich", "Country": "Germany", "Credit_Balance": 2544.0, "Customer_Service_Calls": 1.0, "Days_Since_Last_Purchase": 34.0, "Discount_Usage_Rate": 22.2, "Email_Open_Rate": 33.6, "Gender": "Male", "Lifetime_Value": 3367.15, "Login_Frequency": 29.0, "Membership_Years": 7.5, "Mobile_App_Usage": 39.6, "Pages_Per_Session": 15.9, "Payment_Method_Diversity": 5.0, "Product_Reviews_Written": 10.0, "Returns_Rate": 5.1, "Session_Duration_Avg": 48.9, "Signup_Quarter": "Q3", "Social_Media_Engagement_Score": 59.0, "Total_Purchases": 22.0, "Wishlist_Items": 14.0, "captured_at": "2026-11-15T00:00:00Z", "currency": null, "external_id": "BAOVE-004", "observation_end": null, "observation_start": null, "source": "kaggle-v1-bao-ve"}, "provenance": "source_declared_not_certified"}
ab3ba11b-8efc-4172-9922-dc9644553bbe	454eda24-95dd-45f8-8529-0aea74e06f33	6	38dd4620bd2166601b94709db5c98f5028a5d4cee7077882fb8d20708361bae6	38dd4620bd2166601b94709db5c98f5028a5d4cee7077882fb8d20708361bae6	5ca26488dcc42609c77677f04a9202e0916e11504ac061dfe04550f1dbabc299	60ecc394-6aa6-491e-a094-cbb3dc6a48e9	85d60df5-5232-449c-ad18-0f0fb46bf583	applied	{"identity": {"external_customer_id": "BAOVE-005", "source_system": "kaggle-v1-bao-ve"}, "customer_action": "created", "snapshot_action": "created", "missing_features": [], "input_data": {"Age": 40.0, "Average_Order_Value": 145.04, "Cart_Abandonment_Rate": 51.5, "Churned": 0.0, "City": "Phoenix", "Country": "USA", "Credit_Balance": 2966.0, "Customer_Service_Calls": 1.0, "Days_Since_Last_Purchase": 68.0, "Discount_Usage_Rate": 62.0, "Email_Open_Rate": 0.0, "Gender": "Male", "Lifetime_Value": 1506.54, "Login_Frequency": 18.0, "Membership_Years": 3.2, "Mobile_App_Usage": 7.5, "Pages_Per_Session": 9.9, "Payment_Method_Diversity": 2.0, "Product_Reviews_Written": 1.0, "Returns_Rate": 7.9, "Session_Duration_Avg": 27.0, "Signup_Quarter": "Q3", "Social_Media_Engagement_Score": 27.2, "Total_Purchases": 11.0, "Wishlist_Items": 1.0, "captured_at": "2026-11-15T00:00:00Z", "currency": null, "external_id": "BAOVE-005", "observation_end": null, "observation_start": null, "source": "kaggle-v1-bao-ve"}, "provenance": "source_declared_not_certified"}
51f21262-deed-4dcd-b084-e44de6780a88	454eda24-95dd-45f8-8529-0aea74e06f33	7	4e70bd5c23d10782b5259d2d4edf73f0a43ce17b80ebdf215914379c6a917f28	4e70bd5c23d10782b5259d2d4edf73f0a43ce17b80ebdf215914379c6a917f28	1381393fc7114df6ce20b2e50655712efce829670efeb995bc714217f5cb4a57	35a65074-15a4-471a-b62d-560656bb7cc0	e6c8f581-ea52-4197-b14d-bde1a5f4cec9	applied	{"identity": {"external_customer_id": "BAOVE-006", "source_system": "kaggle-v1-bao-ve"}, "customer_action": "created", "snapshot_action": "created", "missing_features": [], "input_data": {"Age": 36.0, "Average_Order_Value": 199.48, "Cart_Abandonment_Rate": 75.1, "Churned": 0.0, "City": "Chicago", "Country": "USA", "Credit_Balance": 1416.0, "Customer_Service_Calls": 6.0, "Days_Since_Last_Purchase": 43.0, "Discount_Usage_Rate": 47.8, "Email_Open_Rate": 11.6, "Gender": "Male", "Lifetime_Value": 1133.62, "Login_Frequency": 0.0, "Membership_Years": 1.4, "Mobile_App_Usage": 19.9, "Pages_Per_Session": 5.1, "Payment_Method_Diversity": 3.0, "Product_Reviews_Written": 1.0, "Returns_Rate": 2.1, "Session_Duration_Avg": 33.0, "Signup_Quarter": "Q2", "Social_Media_Engagement_Score": 23.9, "Total_Purchases": 6.0, "Wishlist_Items": 4.0, "captured_at": "2026-11-15T00:00:00Z", "currency": null, "external_id": "BAOVE-006", "observation_end": null, "observation_start": null, "source": "kaggle-v1-bao-ve"}, "provenance": "source_declared_not_certified"}
60d1b8f0-9961-4d99-83d0-514e48cc2576	454eda24-95dd-45f8-8529-0aea74e06f33	8	c93ec8e80f5c64a1cc66994b17826acf031755aa6d7c7941ccf32f6ad233330d	c93ec8e80f5c64a1cc66994b17826acf031755aa6d7c7941ccf32f6ad233330d	75f4f57309e068975e8adf32923117d170d4b29d65743458aee44bdb6b81f7e3	dbd047a8-f3e5-475c-8acd-b009407de2e1	f137ef20-f5f3-4ab3-adaa-a3b95bde5caa	applied	{"identity": {"external_customer_id": "BAOVE-007", "source_system": "kaggle-v1-bao-ve"}, "customer_action": "created", "snapshot_action": "created", "missing_features": [], "input_data": {"Age": 41.0, "Average_Order_Value": 111.93, "Cart_Abandonment_Rate": 46.8, "Churned": 0.0, "City": "Chicago", "Country": "USA", "Credit_Balance": 2442.0, "Customer_Service_Calls": 4.0, "Days_Since_Last_Purchase": 48.0, "Discount_Usage_Rate": 25.1, "Email_Open_Rate": 39.2, "Gender": "Male", "Lifetime_Value": 1862.75, "Login_Frequency": 23.0, "Membership_Years": 3.4, "Mobile_App_Usage": 27.8, "Pages_Per_Session": 14.2, "Payment_Method_Diversity": 1.0, "Product_Reviews_Written": 1.0, "Returns_Rate": 17.0, "Session_Duration_Avg": 44.6, "Signup_Quarter": "Q3", "Social_Media_Engagement_Score": 35.2, "Total_Purchases": 15.0, "Wishlist_Items": 5.0, "captured_at": "2026-11-15T00:00:00Z", "currency": null, "external_id": "BAOVE-007", "observation_end": null, "observation_start": null, "source": "kaggle-v1-bao-ve"}, "provenance": "source_declared_not_certified"}
617dfba7-512a-48d1-bb05-25c1f93e312a	454eda24-95dd-45f8-8529-0aea74e06f33	9	096408282839d4f959b0cddf1e6acc4ec5299b6e7d115b8538081aff90245de4	\N	ed0a4fe96c663828d8535e240616562ec5df65e8a5d556798beb0114a19862af	31c63922-7346-414c-8346-deae09984763	71a3fc19-abba-49d9-a693-c3acaed40168	applied	{"identity": {"external_customer_id": "BAOVE-008", "source_system": "kaggle-v1-bao-ve"}, "customer_action": "matched", "snapshot_action": "reused", "missing_features": [], "input_data": {"Age": 42.0, "Average_Order_Value": 150.38, "Cart_Abandonment_Rate": 62.5, "Churned": 0.0, "City": "Chicago", "Country": "USA", "Credit_Balance": 2656.0, "Customer_Service_Calls": 2.0, "Days_Since_Last_Purchase": 24.0, "Discount_Usage_Rate": 71.3, "Email_Open_Rate": 23.3, "Gender": "Male", "Lifetime_Value": 1345.57, "Login_Frequency": 7.0, "Membership_Years": 3.4, "Mobile_App_Usage": 18.9, "Pages_Per_Session": 12.2, "Payment_Method_Diversity": 2.0, "Product_Reviews_Written": 2.0, "Returns_Rate": 7.0, "Session_Duration_Avg": 25.9, "Signup_Quarter": "Q2", "Social_Media_Engagement_Score": 4.7, "Total_Purchases": 10.0, "Wishlist_Items": 4.0, "captured_at": "2026-11-15T00:00:00Z", "currency": null, "external_id": "BAOVE-008", "observation_end": null, "observation_start": null, "source": "kaggle-v1-bao-ve"}, "provenance": "source_declared_not_certified"}
4c382ecc-b3be-4803-9bfb-7d636f85b70e	454eda24-95dd-45f8-8529-0aea74e06f33	10	74bb9e7ebc8e5a6b81a78ab769d7b4dd0af5a245d7b281e2f40e67bbc35127e2	74bb9e7ebc8e5a6b81a78ab769d7b4dd0af5a245d7b281e2f40e67bbc35127e2	38f1f50a79a6001e61ffce6b7b8fecbc91c3495cedb67a7e5fb2d45fdd41c7a6	45a52008-364c-4668-b267-e9a1e68cb835	cdc5c880-352e-40d1-8c7d-a993b2b39df5	applied	{"identity": {"external_customer_id": "BAOVE-009", "source_system": "kaggle-v1-bao-ve"}, "customer_action": "created", "snapshot_action": "created", "missing_features": [], "input_data": {"Age": 51.0, "Average_Order_Value": 125.34, "Cart_Abandonment_Rate": 51.5, "Churned": 0.0, "City": "Hamburg", "Country": "Germany", "Credit_Balance": 1607.0, "Customer_Service_Calls": 3.0, "Days_Since_Last_Purchase": 34.0, "Discount_Usage_Rate": 55.7, "Email_Open_Rate": 37.8, "Gender": "Female", "Lifetime_Value": 1651.78, "Login_Frequency": 8.0, "Membership_Years": 1.7, "Mobile_App_Usage": 11.5, "Pages_Per_Session": 6.5, "Payment_Method_Diversity": 2.0, "Product_Reviews_Written": 1.0, "Returns_Rate": 3.1, "Session_Duration_Avg": 24.0, "Signup_Quarter": "Q1", "Social_Media_Engagement_Score": 69.0, "Total_Purchases": 12.0, "Wishlist_Items": 5.0, "captured_at": "2026-11-15T00:00:00Z", "currency": null, "external_id": "BAOVE-009", "observation_end": null, "observation_start": null, "source": "kaggle-v1-bao-ve"}, "provenance": "source_declared_not_certified"}
1ac9d363-5d80-4c81-8ffe-d537fdac1f9b	454eda24-95dd-45f8-8529-0aea74e06f33	11	81651018e8879f08f6f4120a726c880459c27cc4dbdad87089a3aa8e574ae9cf	81651018e8879f08f6f4120a726c880459c27cc4dbdad87089a3aa8e574ae9cf	57bbd8b4c89b01d2ee8e1385173407fe718bc796866a9ccc6dcebe3b4f3875e4	f770ce3f-2c85-41d6-b30e-55e2cde77409	01dba1fc-b97c-4186-be58-cd7777eb89a5	applied	{"identity": {"external_customer_id": "BAOVE-010", "source_system": "kaggle-v1-bao-ve"}, "customer_action": "created", "snapshot_action": "created", "missing_features": [], "input_data": {"Age": 47.0, "Average_Order_Value": 121.45, "Cart_Abandonment_Rate": 62.3, "Churned": 0.0, "City": "Glasgow", "Country": "UK", "Credit_Balance": 3482.0, "Customer_Service_Calls": 8.0, "Days_Since_Last_Purchase": 1.0, "Discount_Usage_Rate": 21.6, "Email_Open_Rate": 12.8, "Gender": "Female", "Lifetime_Value": 725.92, "Login_Frequency": 9.0, "Membership_Years": 2.1, "Mobile_App_Usage": 15.5, "Pages_Per_Session": 5.1, "Payment_Method_Diversity": 1.0, "Product_Reviews_Written": 2.0, "Returns_Rate": 2.7, "Session_Duration_Avg": 16.3, "Signup_Quarter": "Q3", "Social_Media_Engagement_Score": 10.0, "Total_Purchases": 6.0, "Wishlist_Items": 5.0, "captured_at": "2026-11-15T00:00:00Z", "currency": null, "external_id": "BAOVE-010", "observation_end": null, "observation_start": null, "source": "kaggle-v1-bao-ve"}, "provenance": "source_declared_not_certified"}
cfbd616d-ed24-4525-bfa6-f5593a560ded	454eda24-95dd-45f8-8529-0aea74e06f33	12	6539865817f0094fb2730ca7e2cf253e35a0c91f46e76b0fe24cd223b0f9a7be	6539865817f0094fb2730ca7e2cf253e35a0c91f46e76b0fe24cd223b0f9a7be	17fba5632e8d0428ef2194b6758001cd3805595a7021ab0ab8eca010a36b1f82	7c99aa26-bd79-4af6-b3a6-c12d584a74a3	1aa63836-efcd-4e55-80f3-55e1371df090	applied	{"identity": {"external_customer_id": "BAOVE-011", "source_system": "kaggle-v1-bao-ve"}, "customer_action": "created", "snapshot_action": "created", "missing_features": [], "input_data": {"Age": 43.0, "Average_Order_Value": 96.62, "Cart_Abandonment_Rate": 63.1, "Churned": 0.0, "City": "Adelaide", "Country": "Australia", "Credit_Balance": 1549.0, "Customer_Service_Calls": 5.0, "Days_Since_Last_Purchase": 65.0, "Discount_Usage_Rate": 30.3, "Email_Open_Rate": 6.3, "Gender": "Male", "Lifetime_Value": 824.37, "Login_Frequency": 13.0, "Membership_Years": 3.4, "Mobile_App_Usage": 19.4, "Pages_Per_Session": 11.2, "Payment_Method_Diversity": 2.0, "Product_Reviews_Written": 3.0, "Returns_Rate": 6.7, "Session_Duration_Avg": 26.6, "Signup_Quarter": "Q3", "Social_Media_Engagement_Score": 29.4, "Total_Purchases": 8.0, "Wishlist_Items": 4.0, "captured_at": "2026-11-15T00:00:00Z", "currency": null, "external_id": "BAOVE-011", "observation_end": null, "observation_start": null, "source": "kaggle-v1-bao-ve"}, "provenance": "source_declared_not_certified"}
e48e10cb-12f6-4470-bc25-be5254948716	454eda24-95dd-45f8-8529-0aea74e06f33	13	0b6324ddd0d2684ff17ee0398892cb3a1e35a3fb02a04048d7b68e61b5a68a7e	0b6324ddd0d2684ff17ee0398892cb3a1e35a3fb02a04048d7b68e61b5a68a7e	e5c00563fe4e8d87af646099e93dae5818cd0d3393f8ea6e1b99360023ab610d	512e5df4-5b71-4063-86b2-bf4383fa076c	00df99b7-d3c2-448e-a3cf-136f052188e1	applied	{"identity": {"external_customer_id": "BAOVE-012", "source_system": "kaggle-v1-bao-ve"}, "customer_action": "created", "snapshot_action": "created", "missing_features": [], "input_data": {"Age": 42.0, "Average_Order_Value": 178.42, "Cart_Abandonment_Rate": 59.2, "Churned": 0.0, "City": "Phoenix", "Country": "USA", "Credit_Balance": 1549.0, "Customer_Service_Calls": 10.0, "Days_Since_Last_Purchase": 5.0, "Discount_Usage_Rate": 20.279999999999998, "Email_Open_Rate": 3.6, "Gender": "Male", "Lifetime_Value": 1022.78, "Login_Frequency": 3.0, "Membership_Years": 4.7, "Mobile_App_Usage": 16.9, "Pages_Per_Session": 7.4, "Payment_Method_Diversity": 2.0, "Product_Reviews_Written": 3.0, "Returns_Rate": 1.1, "Session_Duration_Avg": 17.7, "Signup_Quarter": "Q4", "Social_Media_Engagement_Score": 8.5, "Total_Purchases": 7.800000000000001, "Wishlist_Items": 1.0, "captured_at": "2026-11-15T00:00:00Z", "currency": null, "external_id": "BAOVE-012", "observation_end": null, "observation_start": null, "source": "kaggle-v1-bao-ve"}, "provenance": "source_declared_not_certified"}
92ef2ffc-2146-4560-9edd-37e576ea0ed2	21a1d4a6-dc73-4959-91a1-8379cd61ec88	2	0b4479d5bea4ed0d3f047c21be356bb144af61058936a4343505f7a9d41c73e1	\N	dc3b99876aae983c0e3b30462f5b49ba3707da0a362e9895eb9096cca2cab616	727ec9c1-79ad-4c07-acfe-8daf9690fb2c	3ea17821-fe0c-467b-8ee4-d8a1716c8db4	applied	{"identity": {"external_customer_id": "BAOVE-001", "source_system": "kaggle-v1-bao-ve"}, "customer_action": "matched", "snapshot_action": "reused", "missing_features": [], "input_data": {"Age": 56.0, "Average_Order_Value": 147.33, "Cart_Abandonment_Rate": 41.7, "Churned": 0.0, "City": "New York", "Country": "USA", "Credit_Balance": 2674.0, "Customer_Service_Calls": 2.0, "Days_Since_Last_Purchase": 47.0, "Discount_Usage_Rate": 44.1, "Email_Open_Rate": 41.4, "Gender": "Female", "Lifetime_Value": 2340.92, "Login_Frequency": 10.0, "Membership_Years": 2.6, "Mobile_App_Usage": 31.0, "Pages_Per_Session": 14.8, "Payment_Method_Diversity": 3.0, "Product_Reviews_Written": 5.0, "Returns_Rate": 5.4, "Session_Duration_Avg": 38.4, "Signup_Quarter": "Q1", "Social_Media_Engagement_Score": 85.9, "Total_Purchases": 15.0, "Wishlist_Items": 9.0, "captured_at": "2026-11-15T00:00:00Z", "currency": null, "external_id": "BAOVE-001", "observation_end": null, "observation_start": null, "source": "kaggle-v1-bao-ve"}, "provenance": "source_declared_not_certified"}
4bcb47d4-cebb-4c79-9e76-fa7997889c7e	21a1d4a6-dc73-4959-91a1-8379cd61ec88	3	92c76b0ffe560d6f8faa2a638c7086a9c074c92738cb296a58756b8e99baacf1	\N	a63f1b5d5d69506139ea25f4a638b188fcde92c7726a3b7f27c77bd7afaa208b	ca7c6bc9-5e44-424f-8fe2-75c5b00201a0	a06ed6d7-559b-4f15-ba70-719f1a96648d	applied	{"identity": {"external_customer_id": "BAOVE-002", "source_system": "kaggle-v1-bao-ve"}, "customer_action": "matched", "snapshot_action": "reused", "missing_features": [], "input_data": {"Age": 55.0, "Average_Order_Value": 108.52, "Cart_Abandonment_Rate": 25.2, "Churned": 0.0, "City": "Bangalore", "Country": "India", "Credit_Balance": 4561.0, "Customer_Service_Calls": 1.0, "Days_Since_Last_Purchase": 4.0, "Discount_Usage_Rate": 33.0, "Email_Open_Rate": 72.1, "Gender": "Female", "Lifetime_Value": 3063.29, "Login_Frequency": 24.0, "Membership_Years": 1.2, "Mobile_App_Usage": 37.8, "Pages_Per_Session": 16.0, "Payment_Method_Diversity": 1.0, "Product_Reviews_Written": 5.0, "Returns_Rate": 11.6, "Session_Duration_Avg": 50.3, "Signup_Quarter": "Q1", "Social_Media_Engagement_Score": 76.7, "Total_Purchases": 24.0, "Wishlist_Items": 9.0, "captured_at": "2026-11-15T00:00:00Z", "currency": null, "external_id": "BAOVE-002", "observation_end": null, "observation_start": null, "source": "kaggle-v1-bao-ve"}, "provenance": "source_declared_not_certified"}
acbd0ae8-72e3-459d-b081-746a839038ff	21a1d4a6-dc73-4959-91a1-8379cd61ec88	4	7862236d9d91f67cc46160123dbeb8683f54223f8993c2db9c58ccbf49bfb74a	\N	3ab3a3f7b356fba3a128709450adc65df7f1074398d188a8bb23592ecbfb75a9	0a9ab69a-3e34-41bd-91bd-2ff1a9611e13	32464d68-d517-4fda-9cdb-e04204f8efe9	applied	{"identity": {"external_customer_id": "BAOVE-003", "source_system": "kaggle-v1-bao-ve"}, "customer_action": "matched", "snapshot_action": "reused", "missing_features": [], "input_data": {"Age": 34.0, "Average_Order_Value": 65.22, "Cart_Abandonment_Rate": 38.3, "Churned": 0.0, "City": "Yokohama", "Country": "Japan", "Credit_Balance": 1889.0, "Customer_Service_Calls": 1.0, "Days_Since_Last_Purchase": 10.0, "Discount_Usage_Rate": 32.3, "Email_Open_Rate": 23.8, "Gender": "Male", "Lifetime_Value": 1226.33, "Login_Frequency": 12.0, "Membership_Years": 4.4, "Mobile_App_Usage": 28.8, "Pages_Per_Session": 13.3, "Payment_Method_Diversity": 2.0, "Product_Reviews_Written": 2.0, "Returns_Rate": 5.9, "Session_Duration_Avg": 42.1, "Signup_Quarter": "Q3", "Social_Media_Engagement_Score": 38.8, "Total_Purchases": 17.0, "Wishlist_Items": 8.0, "captured_at": "2026-11-15T00:00:00Z", "currency": null, "external_id": "BAOVE-003", "observation_end": null, "observation_start": null, "source": "kaggle-v1-bao-ve"}, "provenance": "source_declared_not_certified"}
978c5be8-6696-432c-855c-fc93129f2179	21a1d4a6-dc73-4959-91a1-8379cd61ec88	5	7092b04bd61ae246236f624f99f4a58b75e22a916cad72d33047cb4f7b2ffe0e	\N	cd459b3041ef6d93b085c0c259fa6392967af0daddd52cdbc6bcd9e301702661	946fe89f-61ca-41a3-b193-878471e439c2	fdf9215b-960a-44d3-98f9-6683a2c590f7	applied	{"identity": {"external_customer_id": "BAOVE-004", "source_system": "kaggle-v1-bao-ve"}, "customer_action": "matched", "snapshot_action": "reused", "missing_features": [], "input_data": {"Age": 37.0, "Average_Order_Value": 134.1, "Cart_Abandonment_Rate": 27.8, "Churned": 1.0, "City": "Munich", "Country": "Germany", "Credit_Balance": 2544.0, "Customer_Service_Calls": 1.0, "Days_Since_Last_Purchase": 34.0, "Discount_Usage_Rate": 22.2, "Email_Open_Rate": 33.6, "Gender": "Male", "Lifetime_Value": 3367.15, "Login_Frequency": 29.0, "Membership_Years": 7.5, "Mobile_App_Usage": 39.6, "Pages_Per_Session": 15.9, "Payment_Method_Diversity": 5.0, "Product_Reviews_Written": 10.0, "Returns_Rate": 5.1, "Session_Duration_Avg": 48.9, "Signup_Quarter": "Q3", "Social_Media_Engagement_Score": 59.0, "Total_Purchases": 22.0, "Wishlist_Items": 14.0, "captured_at": "2026-11-15T00:00:00Z", "currency": null, "external_id": "BAOVE-004", "observation_end": null, "observation_start": null, "source": "kaggle-v1-bao-ve"}, "provenance": "source_declared_not_certified"}
7042a2e4-c173-49de-8212-c0e11a4ba13e	21a1d4a6-dc73-4959-91a1-8379cd61ec88	6	38dd4620bd2166601b94709db5c98f5028a5d4cee7077882fb8d20708361bae6	\N	5ca26488dcc42609c77677f04a9202e0916e11504ac061dfe04550f1dbabc299	60ecc394-6aa6-491e-a094-cbb3dc6a48e9	85d60df5-5232-449c-ad18-0f0fb46bf583	applied	{"identity": {"external_customer_id": "BAOVE-005", "source_system": "kaggle-v1-bao-ve"}, "customer_action": "matched", "snapshot_action": "reused", "missing_features": [], "input_data": {"Age": 40.0, "Average_Order_Value": 145.04, "Cart_Abandonment_Rate": 51.5, "Churned": 0.0, "City": "Phoenix", "Country": "USA", "Credit_Balance": 2966.0, "Customer_Service_Calls": 1.0, "Days_Since_Last_Purchase": 68.0, "Discount_Usage_Rate": 62.0, "Email_Open_Rate": 0.0, "Gender": "Male", "Lifetime_Value": 1506.54, "Login_Frequency": 18.0, "Membership_Years": 3.2, "Mobile_App_Usage": 7.5, "Pages_Per_Session": 9.9, "Payment_Method_Diversity": 2.0, "Product_Reviews_Written": 1.0, "Returns_Rate": 7.9, "Session_Duration_Avg": 27.0, "Signup_Quarter": "Q3", "Social_Media_Engagement_Score": 27.2, "Total_Purchases": 11.0, "Wishlist_Items": 1.0, "captured_at": "2026-11-15T00:00:00Z", "currency": null, "external_id": "BAOVE-005", "observation_end": null, "observation_start": null, "source": "kaggle-v1-bao-ve"}, "provenance": "source_declared_not_certified"}
b13ebcad-cd69-4297-8155-b387f69e9ea8	21a1d4a6-dc73-4959-91a1-8379cd61ec88	7	4e70bd5c23d10782b5259d2d4edf73f0a43ce17b80ebdf215914379c6a917f28	\N	1381393fc7114df6ce20b2e50655712efce829670efeb995bc714217f5cb4a57	35a65074-15a4-471a-b62d-560656bb7cc0	e6c8f581-ea52-4197-b14d-bde1a5f4cec9	applied	{"identity": {"external_customer_id": "BAOVE-006", "source_system": "kaggle-v1-bao-ve"}, "customer_action": "matched", "snapshot_action": "reused", "missing_features": [], "input_data": {"Age": 36.0, "Average_Order_Value": 199.48, "Cart_Abandonment_Rate": 75.1, "Churned": 0.0, "City": "Chicago", "Country": "USA", "Credit_Balance": 1416.0, "Customer_Service_Calls": 6.0, "Days_Since_Last_Purchase": 43.0, "Discount_Usage_Rate": 47.8, "Email_Open_Rate": 11.6, "Gender": "Male", "Lifetime_Value": 1133.62, "Login_Frequency": 0.0, "Membership_Years": 1.4, "Mobile_App_Usage": 19.9, "Pages_Per_Session": 5.1, "Payment_Method_Diversity": 3.0, "Product_Reviews_Written": 1.0, "Returns_Rate": 2.1, "Session_Duration_Avg": 33.0, "Signup_Quarter": "Q2", "Social_Media_Engagement_Score": 23.9, "Total_Purchases": 6.0, "Wishlist_Items": 4.0, "captured_at": "2026-11-15T00:00:00Z", "currency": null, "external_id": "BAOVE-006", "observation_end": null, "observation_start": null, "source": "kaggle-v1-bao-ve"}, "provenance": "source_declared_not_certified"}
77a14556-85a7-4bf5-a1aa-7326ee92c628	21a1d4a6-dc73-4959-91a1-8379cd61ec88	8	c93ec8e80f5c64a1cc66994b17826acf031755aa6d7c7941ccf32f6ad233330d	\N	75f4f57309e068975e8adf32923117d170d4b29d65743458aee44bdb6b81f7e3	dbd047a8-f3e5-475c-8acd-b009407de2e1	f137ef20-f5f3-4ab3-adaa-a3b95bde5caa	applied	{"identity": {"external_customer_id": "BAOVE-007", "source_system": "kaggle-v1-bao-ve"}, "customer_action": "matched", "snapshot_action": "reused", "missing_features": [], "input_data": {"Age": 41.0, "Average_Order_Value": 111.93, "Cart_Abandonment_Rate": 46.8, "Churned": 0.0, "City": "Chicago", "Country": "USA", "Credit_Balance": 2442.0, "Customer_Service_Calls": 4.0, "Days_Since_Last_Purchase": 48.0, "Discount_Usage_Rate": 25.1, "Email_Open_Rate": 39.2, "Gender": "Male", "Lifetime_Value": 1862.75, "Login_Frequency": 23.0, "Membership_Years": 3.4, "Mobile_App_Usage": 27.8, "Pages_Per_Session": 14.2, "Payment_Method_Diversity": 1.0, "Product_Reviews_Written": 1.0, "Returns_Rate": 17.0, "Session_Duration_Avg": 44.6, "Signup_Quarter": "Q3", "Social_Media_Engagement_Score": 35.2, "Total_Purchases": 15.0, "Wishlist_Items": 5.0, "captured_at": "2026-11-15T00:00:00Z", "currency": null, "external_id": "BAOVE-007", "observation_end": null, "observation_start": null, "source": "kaggle-v1-bao-ve"}, "provenance": "source_declared_not_certified"}
8bcc7c59-972a-4bc7-9503-ede2a4925e23	21a1d4a6-dc73-4959-91a1-8379cd61ec88	9	096408282839d4f959b0cddf1e6acc4ec5299b6e7d115b8538081aff90245de4	\N	ed0a4fe96c663828d8535e240616562ec5df65e8a5d556798beb0114a19862af	31c63922-7346-414c-8346-deae09984763	71a3fc19-abba-49d9-a693-c3acaed40168	applied	{"identity": {"external_customer_id": "BAOVE-008", "source_system": "kaggle-v1-bao-ve"}, "customer_action": "matched", "snapshot_action": "reused", "missing_features": [], "input_data": {"Age": 42.0, "Average_Order_Value": 150.38, "Cart_Abandonment_Rate": 62.5, "Churned": 0.0, "City": "Chicago", "Country": "USA", "Credit_Balance": 2656.0, "Customer_Service_Calls": 2.0, "Days_Since_Last_Purchase": 24.0, "Discount_Usage_Rate": 71.3, "Email_Open_Rate": 23.3, "Gender": "Male", "Lifetime_Value": 1345.57, "Login_Frequency": 7.0, "Membership_Years": 3.4, "Mobile_App_Usage": 18.9, "Pages_Per_Session": 12.2, "Payment_Method_Diversity": 2.0, "Product_Reviews_Written": 2.0, "Returns_Rate": 7.0, "Session_Duration_Avg": 25.9, "Signup_Quarter": "Q2", "Social_Media_Engagement_Score": 4.7, "Total_Purchases": 10.0, "Wishlist_Items": 4.0, "captured_at": "2026-11-15T00:00:00Z", "currency": null, "external_id": "BAOVE-008", "observation_end": null, "observation_start": null, "source": "kaggle-v1-bao-ve"}, "provenance": "source_declared_not_certified"}
6d957457-e530-401d-ab94-f948b36756dc	21a1d4a6-dc73-4959-91a1-8379cd61ec88	10	74bb9e7ebc8e5a6b81a78ab769d7b4dd0af5a245d7b281e2f40e67bbc35127e2	\N	38f1f50a79a6001e61ffce6b7b8fecbc91c3495cedb67a7e5fb2d45fdd41c7a6	45a52008-364c-4668-b267-e9a1e68cb835	cdc5c880-352e-40d1-8c7d-a993b2b39df5	applied	{"identity": {"external_customer_id": "BAOVE-009", "source_system": "kaggle-v1-bao-ve"}, "customer_action": "matched", "snapshot_action": "reused", "missing_features": [], "input_data": {"Age": 51.0, "Average_Order_Value": 125.34, "Cart_Abandonment_Rate": 51.5, "Churned": 0.0, "City": "Hamburg", "Country": "Germany", "Credit_Balance": 1607.0, "Customer_Service_Calls": 3.0, "Days_Since_Last_Purchase": 34.0, "Discount_Usage_Rate": 55.7, "Email_Open_Rate": 37.8, "Gender": "Female", "Lifetime_Value": 1651.78, "Login_Frequency": 8.0, "Membership_Years": 1.7, "Mobile_App_Usage": 11.5, "Pages_Per_Session": 6.5, "Payment_Method_Diversity": 2.0, "Product_Reviews_Written": 1.0, "Returns_Rate": 3.1, "Session_Duration_Avg": 24.0, "Signup_Quarter": "Q1", "Social_Media_Engagement_Score": 69.0, "Total_Purchases": 12.0, "Wishlist_Items": 5.0, "captured_at": "2026-11-15T00:00:00Z", "currency": null, "external_id": "BAOVE-009", "observation_end": null, "observation_start": null, "source": "kaggle-v1-bao-ve"}, "provenance": "source_declared_not_certified"}
952da276-0b9d-4c30-8acf-6b8ac49a7b93	21a1d4a6-dc73-4959-91a1-8379cd61ec88	11	81651018e8879f08f6f4120a726c880459c27cc4dbdad87089a3aa8e574ae9cf	\N	57bbd8b4c89b01d2ee8e1385173407fe718bc796866a9ccc6dcebe3b4f3875e4	f770ce3f-2c85-41d6-b30e-55e2cde77409	01dba1fc-b97c-4186-be58-cd7777eb89a5	applied	{"identity": {"external_customer_id": "BAOVE-010", "source_system": "kaggle-v1-bao-ve"}, "customer_action": "matched", "snapshot_action": "reused", "missing_features": [], "input_data": {"Age": 47.0, "Average_Order_Value": 121.45, "Cart_Abandonment_Rate": 62.3, "Churned": 0.0, "City": "Glasgow", "Country": "UK", "Credit_Balance": 3482.0, "Customer_Service_Calls": 8.0, "Days_Since_Last_Purchase": 1.0, "Discount_Usage_Rate": 21.6, "Email_Open_Rate": 12.8, "Gender": "Female", "Lifetime_Value": 725.92, "Login_Frequency": 9.0, "Membership_Years": 2.1, "Mobile_App_Usage": 15.5, "Pages_Per_Session": 5.1, "Payment_Method_Diversity": 1.0, "Product_Reviews_Written": 2.0, "Returns_Rate": 2.7, "Session_Duration_Avg": 16.3, "Signup_Quarter": "Q3", "Social_Media_Engagement_Score": 10.0, "Total_Purchases": 6.0, "Wishlist_Items": 5.0, "captured_at": "2026-11-15T00:00:00Z", "currency": null, "external_id": "BAOVE-010", "observation_end": null, "observation_start": null, "source": "kaggle-v1-bao-ve"}, "provenance": "source_declared_not_certified"}
29e3ddcb-f015-44b6-9067-a6cdf34bd6ff	21a1d4a6-dc73-4959-91a1-8379cd61ec88	12	6539865817f0094fb2730ca7e2cf253e35a0c91f46e76b0fe24cd223b0f9a7be	\N	17fba5632e8d0428ef2194b6758001cd3805595a7021ab0ab8eca010a36b1f82	7c99aa26-bd79-4af6-b3a6-c12d584a74a3	1aa63836-efcd-4e55-80f3-55e1371df090	applied	{"identity": {"external_customer_id": "BAOVE-011", "source_system": "kaggle-v1-bao-ve"}, "customer_action": "matched", "snapshot_action": "reused", "missing_features": [], "input_data": {"Age": 43.0, "Average_Order_Value": 96.62, "Cart_Abandonment_Rate": 63.1, "Churned": 0.0, "City": "Adelaide", "Country": "Australia", "Credit_Balance": 1549.0, "Customer_Service_Calls": 5.0, "Days_Since_Last_Purchase": 65.0, "Discount_Usage_Rate": 30.3, "Email_Open_Rate": 6.3, "Gender": "Male", "Lifetime_Value": 824.37, "Login_Frequency": 13.0, "Membership_Years": 3.4, "Mobile_App_Usage": 19.4, "Pages_Per_Session": 11.2, "Payment_Method_Diversity": 2.0, "Product_Reviews_Written": 3.0, "Returns_Rate": 6.7, "Session_Duration_Avg": 26.6, "Signup_Quarter": "Q3", "Social_Media_Engagement_Score": 29.4, "Total_Purchases": 8.0, "Wishlist_Items": 4.0, "captured_at": "2026-11-15T00:00:00Z", "currency": null, "external_id": "BAOVE-011", "observation_end": null, "observation_start": null, "source": "kaggle-v1-bao-ve"}, "provenance": "source_declared_not_certified"}
18798b79-6a12-4d48-a856-f4a620d7c5d3	21a1d4a6-dc73-4959-91a1-8379cd61ec88	13	0b6324ddd0d2684ff17ee0398892cb3a1e35a3fb02a04048d7b68e61b5a68a7e	\N	e5c00563fe4e8d87af646099e93dae5818cd0d3393f8ea6e1b99360023ab610d	512e5df4-5b71-4063-86b2-bf4383fa076c	00df99b7-d3c2-448e-a3cf-136f052188e1	applied	{"identity": {"external_customer_id": "BAOVE-012", "source_system": "kaggle-v1-bao-ve"}, "customer_action": "matched", "snapshot_action": "reused", "missing_features": [], "input_data": {"Age": 42.0, "Average_Order_Value": 178.42, "Cart_Abandonment_Rate": 59.2, "Churned": 0.0, "City": "Phoenix", "Country": "USA", "Credit_Balance": 1549.0, "Customer_Service_Calls": 10.0, "Days_Since_Last_Purchase": 5.0, "Discount_Usage_Rate": 20.279999999999998, "Email_Open_Rate": 3.6, "Gender": "Male", "Lifetime_Value": 1022.78, "Login_Frequency": 3.0, "Membership_Years": 4.7, "Mobile_App_Usage": 16.9, "Pages_Per_Session": 7.4, "Payment_Method_Diversity": 2.0, "Product_Reviews_Written": 3.0, "Returns_Rate": 1.1, "Session_Duration_Avg": 17.7, "Signup_Quarter": "Q4", "Social_Media_Engagement_Score": 8.5, "Total_Purchases": 7.800000000000001, "Wishlist_Items": 1.0, "captured_at": "2026-11-15T00:00:00Z", "currency": null, "external_id": "BAOVE-012", "observation_end": null, "observation_start": null, "source": "kaggle-v1-bao-ve"}, "provenance": "source_declared_not_certified"}
84d7e3d0-116a-4294-8bd2-f21ab6df22b5	f79a2e48-e9f3-4b96-b206-46b3eee6b46e	2	999b36504dc7e0ce8b56f8f3f12a8dbab35f3efd3efc0b0a776e7692eea2d031	999b36504dc7e0ce8b56f8f3f12a8dbab35f3efd3efc0b0a776e7692eea2d031	440a2518a32779656f4c07f26f072d96abaaa7b171be1528a6a583a7a3fc71f8	508fb791-a1f7-4b16-b012-3d62d176bde6	1348daf1-bd90-452d-a65e-97184357ea76	applied	{"identity": {"external_customer_id": "LOI-001", "source_system": "kaggle-v1-bao-ve"}, "customer_action": "created", "snapshot_action": "created", "missing_features": [], "input_data": {"Age": 56.0, "Average_Order_Value": 147.33, "Cart_Abandonment_Rate": 41.7, "Churned": 0.0, "City": "New York", "Country": "USA", "Credit_Balance": 2674.0, "Customer_Service_Calls": 2.0, "Days_Since_Last_Purchase": 47.0, "Discount_Usage_Rate": 44.1, "Email_Open_Rate": 41.4, "Gender": "Female", "Lifetime_Value": 2340.92, "Login_Frequency": 10.0, "Membership_Years": 2.6, "Mobile_App_Usage": 31.0, "Pages_Per_Session": 14.8, "Payment_Method_Diversity": 3.0, "Product_Reviews_Written": 5.0, "Returns_Rate": 5.4, "Session_Duration_Avg": 38.4, "Signup_Quarter": "Q1", "Social_Media_Engagement_Score": 85.9, "Total_Purchases": 15.0, "Wishlist_Items": 9.0, "captured_at": "2026-11-15T00:00:00Z", "currency": null, "external_id": "LOI-001", "observation_end": null, "observation_start": null, "source": "kaggle-v1-bao-ve"}, "provenance": "source_declared_not_certified"}
d73af598-41e8-49a3-933a-885542fed859	f79a2e48-e9f3-4b96-b206-46b3eee6b46e	4	e8686586891935ed413094d1640a6e11f109291ac619083bb6cba8b1cd82944d	e8686586891935ed413094d1640a6e11f109291ac619083bb6cba8b1cd82944d	5ac078a370ec2ab01a55da33cb94b0cf1b0069c46a4337c2af75f56e5be110ef	4ccfd8f9-e500-4706-973a-3bbd09e63e74	5468500a-0345-4c3e-947f-117d267b4496	applied	{"identity": {"external_customer_id": "LOI-003", "source_system": "kaggle-v1-bao-ve"}, "customer_action": "created", "snapshot_action": "created", "missing_features": [], "input_data": {"Age": 34.0, "Average_Order_Value": 65.22, "Cart_Abandonment_Rate": 38.3, "Churned": 0.0, "City": "Yokohama", "Country": "Japan", "Credit_Balance": 1889.0, "Customer_Service_Calls": 1.0, "Days_Since_Last_Purchase": 10.0, "Discount_Usage_Rate": 32.3, "Email_Open_Rate": 23.8, "Gender": "Male", "Lifetime_Value": 1226.33, "Login_Frequency": 12.0, "Membership_Years": 4.4, "Mobile_App_Usage": 28.8, "Pages_Per_Session": 13.3, "Payment_Method_Diversity": 2.0, "Product_Reviews_Written": 2.0, "Returns_Rate": 5.9, "Session_Duration_Avg": 42.1, "Signup_Quarter": "Q3", "Social_Media_Engagement_Score": 38.8, "Total_Purchases": 17.0, "Wishlist_Items": 8.0, "captured_at": "2026-11-15T00:00:00Z", "currency": null, "external_id": "LOI-003", "observation_end": null, "observation_start": null, "source": "kaggle-v1-bao-ve"}, "provenance": "source_declared_not_certified"}
3b15ff3d-543c-4fab-a374-54a424f10da6	f79a2e48-e9f3-4b96-b206-46b3eee6b46e	3	\N	\N	\N	\N	\N	excluded	{"reason": "error", "codes": ["ROW_SCHEMA_ERROR"]}
64da4438-73fe-4985-ba3f-ef15cc140e6b	f79a2e48-e9f3-4b96-b206-46b3eee6b46e	5	\N	\N	\N	\N	\N	excluded	{"reason": "error", "codes": ["ROW_SCHEMA_ERROR"]}
d5a603c8-d1e9-4ddd-98d5-b0c0c16b7bc1	d4783698-ae56-4533-b6ce-bab50e68ca9b	2	0b4479d5bea4ed0d3f047c21be356bb144af61058936a4343505f7a9d41c73e1	\N	dc3b99876aae983c0e3b30462f5b49ba3707da0a362e9895eb9096cca2cab616	727ec9c1-79ad-4c07-acfe-8daf9690fb2c	3ea17821-fe0c-467b-8ee4-d8a1716c8db4	applied	{"identity": {"external_customer_id": "BAOVE-001", "source_system": "kaggle-v1-bao-ve"}, "customer_action": "matched", "snapshot_action": "reused", "missing_features": [], "input_data": {"Age": 56.0, "Average_Order_Value": 147.33, "Cart_Abandonment_Rate": 41.7, "Churned": 0.0, "City": "New York", "Country": "USA", "Credit_Balance": 2674.0, "Customer_Service_Calls": 2.0, "Days_Since_Last_Purchase": 47.0, "Discount_Usage_Rate": 44.1, "Email_Open_Rate": 41.4, "Gender": "Female", "Lifetime_Value": 2340.92, "Login_Frequency": 10.0, "Membership_Years": 2.6, "Mobile_App_Usage": 31.0, "Pages_Per_Session": 14.8, "Payment_Method_Diversity": 3.0, "Product_Reviews_Written": 5.0, "Returns_Rate": 5.4, "Session_Duration_Avg": 38.4, "Signup_Quarter": "Q1", "Social_Media_Engagement_Score": 85.9, "Total_Purchases": 15.0, "Wishlist_Items": 9.0, "captured_at": "2026-11-15T00:00:00Z", "currency": null, "external_id": "BAOVE-001", "observation_end": null, "observation_start": null, "source": "kaggle-v1-bao-ve"}, "provenance": "source_declared_not_certified"}
30bd9231-d6c0-4261-93a0-71f3b511e8cc	d4783698-ae56-4533-b6ce-bab50e68ca9b	3	92c76b0ffe560d6f8faa2a638c7086a9c074c92738cb296a58756b8e99baacf1	\N	a63f1b5d5d69506139ea25f4a638b188fcde92c7726a3b7f27c77bd7afaa208b	ca7c6bc9-5e44-424f-8fe2-75c5b00201a0	a06ed6d7-559b-4f15-ba70-719f1a96648d	applied	{"identity": {"external_customer_id": "BAOVE-002", "source_system": "kaggle-v1-bao-ve"}, "customer_action": "matched", "snapshot_action": "reused", "missing_features": [], "input_data": {"Age": 55.0, "Average_Order_Value": 108.52, "Cart_Abandonment_Rate": 25.2, "Churned": 0.0, "City": "Bangalore", "Country": "India", "Credit_Balance": 4561.0, "Customer_Service_Calls": 1.0, "Days_Since_Last_Purchase": 4.0, "Discount_Usage_Rate": 33.0, "Email_Open_Rate": 72.1, "Gender": "Female", "Lifetime_Value": 3063.29, "Login_Frequency": 24.0, "Membership_Years": 1.2, "Mobile_App_Usage": 37.8, "Pages_Per_Session": 16.0, "Payment_Method_Diversity": 1.0, "Product_Reviews_Written": 5.0, "Returns_Rate": 11.6, "Session_Duration_Avg": 50.3, "Signup_Quarter": "Q1", "Social_Media_Engagement_Score": 76.7, "Total_Purchases": 24.0, "Wishlist_Items": 9.0, "captured_at": "2026-11-15T00:00:00Z", "currency": null, "external_id": "BAOVE-002", "observation_end": null, "observation_start": null, "source": "kaggle-v1-bao-ve"}, "provenance": "source_declared_not_certified"}
4d092a27-22d3-41f3-acb5-fb5f1cd9dcba	d4783698-ae56-4533-b6ce-bab50e68ca9b	4	7862236d9d91f67cc46160123dbeb8683f54223f8993c2db9c58ccbf49bfb74a	\N	3ab3a3f7b356fba3a128709450adc65df7f1074398d188a8bb23592ecbfb75a9	0a9ab69a-3e34-41bd-91bd-2ff1a9611e13	32464d68-d517-4fda-9cdb-e04204f8efe9	applied	{"identity": {"external_customer_id": "BAOVE-003", "source_system": "kaggle-v1-bao-ve"}, "customer_action": "matched", "snapshot_action": "reused", "missing_features": [], "input_data": {"Age": 34.0, "Average_Order_Value": 65.22, "Cart_Abandonment_Rate": 38.3, "Churned": 0.0, "City": "Yokohama", "Country": "Japan", "Credit_Balance": 1889.0, "Customer_Service_Calls": 1.0, "Days_Since_Last_Purchase": 10.0, "Discount_Usage_Rate": 32.3, "Email_Open_Rate": 23.8, "Gender": "Male", "Lifetime_Value": 1226.33, "Login_Frequency": 12.0, "Membership_Years": 4.4, "Mobile_App_Usage": 28.8, "Pages_Per_Session": 13.3, "Payment_Method_Diversity": 2.0, "Product_Reviews_Written": 2.0, "Returns_Rate": 5.9, "Session_Duration_Avg": 42.1, "Signup_Quarter": "Q3", "Social_Media_Engagement_Score": 38.8, "Total_Purchases": 17.0, "Wishlist_Items": 8.0, "captured_at": "2026-11-15T00:00:00Z", "currency": null, "external_id": "BAOVE-003", "observation_end": null, "observation_start": null, "source": "kaggle-v1-bao-ve"}, "provenance": "source_declared_not_certified"}
9fff063f-ba69-4914-9d7f-9961aef0db2e	d4783698-ae56-4533-b6ce-bab50e68ca9b	5	7092b04bd61ae246236f624f99f4a58b75e22a916cad72d33047cb4f7b2ffe0e	\N	cd459b3041ef6d93b085c0c259fa6392967af0daddd52cdbc6bcd9e301702661	946fe89f-61ca-41a3-b193-878471e439c2	fdf9215b-960a-44d3-98f9-6683a2c590f7	applied	{"identity": {"external_customer_id": "BAOVE-004", "source_system": "kaggle-v1-bao-ve"}, "customer_action": "matched", "snapshot_action": "reused", "missing_features": [], "input_data": {"Age": 37.0, "Average_Order_Value": 134.1, "Cart_Abandonment_Rate": 27.8, "Churned": 1.0, "City": "Munich", "Country": "Germany", "Credit_Balance": 2544.0, "Customer_Service_Calls": 1.0, "Days_Since_Last_Purchase": 34.0, "Discount_Usage_Rate": 22.2, "Email_Open_Rate": 33.6, "Gender": "Male", "Lifetime_Value": 3367.15, "Login_Frequency": 29.0, "Membership_Years": 7.5, "Mobile_App_Usage": 39.6, "Pages_Per_Session": 15.9, "Payment_Method_Diversity": 5.0, "Product_Reviews_Written": 10.0, "Returns_Rate": 5.1, "Session_Duration_Avg": 48.9, "Signup_Quarter": "Q3", "Social_Media_Engagement_Score": 59.0, "Total_Purchases": 22.0, "Wishlist_Items": 14.0, "captured_at": "2026-11-15T00:00:00Z", "currency": null, "external_id": "BAOVE-004", "observation_end": null, "observation_start": null, "source": "kaggle-v1-bao-ve"}, "provenance": "source_declared_not_certified"}
0ac83d55-2af8-4f50-b93a-d635399a5076	d4783698-ae56-4533-b6ce-bab50e68ca9b	6	38dd4620bd2166601b94709db5c98f5028a5d4cee7077882fb8d20708361bae6	\N	5ca26488dcc42609c77677f04a9202e0916e11504ac061dfe04550f1dbabc299	60ecc394-6aa6-491e-a094-cbb3dc6a48e9	85d60df5-5232-449c-ad18-0f0fb46bf583	applied	{"identity": {"external_customer_id": "BAOVE-005", "source_system": "kaggle-v1-bao-ve"}, "customer_action": "matched", "snapshot_action": "reused", "missing_features": [], "input_data": {"Age": 40.0, "Average_Order_Value": 145.04, "Cart_Abandonment_Rate": 51.5, "Churned": 0.0, "City": "Phoenix", "Country": "USA", "Credit_Balance": 2966.0, "Customer_Service_Calls": 1.0, "Days_Since_Last_Purchase": 68.0, "Discount_Usage_Rate": 62.0, "Email_Open_Rate": 0.0, "Gender": "Male", "Lifetime_Value": 1506.54, "Login_Frequency": 18.0, "Membership_Years": 3.2, "Mobile_App_Usage": 7.5, "Pages_Per_Session": 9.9, "Payment_Method_Diversity": 2.0, "Product_Reviews_Written": 1.0, "Returns_Rate": 7.9, "Session_Duration_Avg": 27.0, "Signup_Quarter": "Q3", "Social_Media_Engagement_Score": 27.2, "Total_Purchases": 11.0, "Wishlist_Items": 1.0, "captured_at": "2026-11-15T00:00:00Z", "currency": null, "external_id": "BAOVE-005", "observation_end": null, "observation_start": null, "source": "kaggle-v1-bao-ve"}, "provenance": "source_declared_not_certified"}
d18fc149-6bbd-47c1-9f22-89542b5d183a	d4783698-ae56-4533-b6ce-bab50e68ca9b	7	4e70bd5c23d10782b5259d2d4edf73f0a43ce17b80ebdf215914379c6a917f28	\N	1381393fc7114df6ce20b2e50655712efce829670efeb995bc714217f5cb4a57	35a65074-15a4-471a-b62d-560656bb7cc0	e6c8f581-ea52-4197-b14d-bde1a5f4cec9	applied	{"identity": {"external_customer_id": "BAOVE-006", "source_system": "kaggle-v1-bao-ve"}, "customer_action": "matched", "snapshot_action": "reused", "missing_features": [], "input_data": {"Age": 36.0, "Average_Order_Value": 199.48, "Cart_Abandonment_Rate": 75.1, "Churned": 0.0, "City": "Chicago", "Country": "USA", "Credit_Balance": 1416.0, "Customer_Service_Calls": 6.0, "Days_Since_Last_Purchase": 43.0, "Discount_Usage_Rate": 47.8, "Email_Open_Rate": 11.6, "Gender": "Male", "Lifetime_Value": 1133.62, "Login_Frequency": 0.0, "Membership_Years": 1.4, "Mobile_App_Usage": 19.9, "Pages_Per_Session": 5.1, "Payment_Method_Diversity": 3.0, "Product_Reviews_Written": 1.0, "Returns_Rate": 2.1, "Session_Duration_Avg": 33.0, "Signup_Quarter": "Q2", "Social_Media_Engagement_Score": 23.9, "Total_Purchases": 6.0, "Wishlist_Items": 4.0, "captured_at": "2026-11-15T00:00:00Z", "currency": null, "external_id": "BAOVE-006", "observation_end": null, "observation_start": null, "source": "kaggle-v1-bao-ve"}, "provenance": "source_declared_not_certified"}
d1376661-1bc8-4e2b-bf6e-15090f553f6d	d4783698-ae56-4533-b6ce-bab50e68ca9b	8	c93ec8e80f5c64a1cc66994b17826acf031755aa6d7c7941ccf32f6ad233330d	\N	75f4f57309e068975e8adf32923117d170d4b29d65743458aee44bdb6b81f7e3	dbd047a8-f3e5-475c-8acd-b009407de2e1	f137ef20-f5f3-4ab3-adaa-a3b95bde5caa	applied	{"identity": {"external_customer_id": "BAOVE-007", "source_system": "kaggle-v1-bao-ve"}, "customer_action": "matched", "snapshot_action": "reused", "missing_features": [], "input_data": {"Age": 41.0, "Average_Order_Value": 111.93, "Cart_Abandonment_Rate": 46.8, "Churned": 0.0, "City": "Chicago", "Country": "USA", "Credit_Balance": 2442.0, "Customer_Service_Calls": 4.0, "Days_Since_Last_Purchase": 48.0, "Discount_Usage_Rate": 25.1, "Email_Open_Rate": 39.2, "Gender": "Male", "Lifetime_Value": 1862.75, "Login_Frequency": 23.0, "Membership_Years": 3.4, "Mobile_App_Usage": 27.8, "Pages_Per_Session": 14.2, "Payment_Method_Diversity": 1.0, "Product_Reviews_Written": 1.0, "Returns_Rate": 17.0, "Session_Duration_Avg": 44.6, "Signup_Quarter": "Q3", "Social_Media_Engagement_Score": 35.2, "Total_Purchases": 15.0, "Wishlist_Items": 5.0, "captured_at": "2026-11-15T00:00:00Z", "currency": null, "external_id": "BAOVE-007", "observation_end": null, "observation_start": null, "source": "kaggle-v1-bao-ve"}, "provenance": "source_declared_not_certified"}
dd9cbc27-c710-47fc-b49e-8e937fa0b485	d4783698-ae56-4533-b6ce-bab50e68ca9b	9	096408282839d4f959b0cddf1e6acc4ec5299b6e7d115b8538081aff90245de4	\N	ed0a4fe96c663828d8535e240616562ec5df65e8a5d556798beb0114a19862af	31c63922-7346-414c-8346-deae09984763	71a3fc19-abba-49d9-a693-c3acaed40168	applied	{"identity": {"external_customer_id": "BAOVE-008", "source_system": "kaggle-v1-bao-ve"}, "customer_action": "matched", "snapshot_action": "reused", "missing_features": [], "input_data": {"Age": 42.0, "Average_Order_Value": 150.38, "Cart_Abandonment_Rate": 62.5, "Churned": 0.0, "City": "Chicago", "Country": "USA", "Credit_Balance": 2656.0, "Customer_Service_Calls": 2.0, "Days_Since_Last_Purchase": 24.0, "Discount_Usage_Rate": 71.3, "Email_Open_Rate": 23.3, "Gender": "Male", "Lifetime_Value": 1345.57, "Login_Frequency": 7.0, "Membership_Years": 3.4, "Mobile_App_Usage": 18.9, "Pages_Per_Session": 12.2, "Payment_Method_Diversity": 2.0, "Product_Reviews_Written": 2.0, "Returns_Rate": 7.0, "Session_Duration_Avg": 25.9, "Signup_Quarter": "Q2", "Social_Media_Engagement_Score": 4.7, "Total_Purchases": 10.0, "Wishlist_Items": 4.0, "captured_at": "2026-11-15T00:00:00Z", "currency": null, "external_id": "BAOVE-008", "observation_end": null, "observation_start": null, "source": "kaggle-v1-bao-ve"}, "provenance": "source_declared_not_certified"}
8222f93b-1057-43b0-ac86-390197827604	d4783698-ae56-4533-b6ce-bab50e68ca9b	10	74bb9e7ebc8e5a6b81a78ab769d7b4dd0af5a245d7b281e2f40e67bbc35127e2	\N	38f1f50a79a6001e61ffce6b7b8fecbc91c3495cedb67a7e5fb2d45fdd41c7a6	45a52008-364c-4668-b267-e9a1e68cb835	cdc5c880-352e-40d1-8c7d-a993b2b39df5	applied	{"identity": {"external_customer_id": "BAOVE-009", "source_system": "kaggle-v1-bao-ve"}, "customer_action": "matched", "snapshot_action": "reused", "missing_features": [], "input_data": {"Age": 51.0, "Average_Order_Value": 125.34, "Cart_Abandonment_Rate": 51.5, "Churned": 0.0, "City": "Hamburg", "Country": "Germany", "Credit_Balance": 1607.0, "Customer_Service_Calls": 3.0, "Days_Since_Last_Purchase": 34.0, "Discount_Usage_Rate": 55.7, "Email_Open_Rate": 37.8, "Gender": "Female", "Lifetime_Value": 1651.78, "Login_Frequency": 8.0, "Membership_Years": 1.7, "Mobile_App_Usage": 11.5, "Pages_Per_Session": 6.5, "Payment_Method_Diversity": 2.0, "Product_Reviews_Written": 1.0, "Returns_Rate": 3.1, "Session_Duration_Avg": 24.0, "Signup_Quarter": "Q1", "Social_Media_Engagement_Score": 69.0, "Total_Purchases": 12.0, "Wishlist_Items": 5.0, "captured_at": "2026-11-15T00:00:00Z", "currency": null, "external_id": "BAOVE-009", "observation_end": null, "observation_start": null, "source": "kaggle-v1-bao-ve"}, "provenance": "source_declared_not_certified"}
56553f22-2f1e-41ec-858d-55842e6ebdd3	d4783698-ae56-4533-b6ce-bab50e68ca9b	11	81651018e8879f08f6f4120a726c880459c27cc4dbdad87089a3aa8e574ae9cf	\N	57bbd8b4c89b01d2ee8e1385173407fe718bc796866a9ccc6dcebe3b4f3875e4	f770ce3f-2c85-41d6-b30e-55e2cde77409	01dba1fc-b97c-4186-be58-cd7777eb89a5	applied	{"identity": {"external_customer_id": "BAOVE-010", "source_system": "kaggle-v1-bao-ve"}, "customer_action": "matched", "snapshot_action": "reused", "missing_features": [], "input_data": {"Age": 47.0, "Average_Order_Value": 121.45, "Cart_Abandonment_Rate": 62.3, "Churned": 0.0, "City": "Glasgow", "Country": "UK", "Credit_Balance": 3482.0, "Customer_Service_Calls": 8.0, "Days_Since_Last_Purchase": 1.0, "Discount_Usage_Rate": 21.6, "Email_Open_Rate": 12.8, "Gender": "Female", "Lifetime_Value": 725.92, "Login_Frequency": 9.0, "Membership_Years": 2.1, "Mobile_App_Usage": 15.5, "Pages_Per_Session": 5.1, "Payment_Method_Diversity": 1.0, "Product_Reviews_Written": 2.0, "Returns_Rate": 2.7, "Session_Duration_Avg": 16.3, "Signup_Quarter": "Q3", "Social_Media_Engagement_Score": 10.0, "Total_Purchases": 6.0, "Wishlist_Items": 5.0, "captured_at": "2026-11-15T00:00:00Z", "currency": null, "external_id": "BAOVE-010", "observation_end": null, "observation_start": null, "source": "kaggle-v1-bao-ve"}, "provenance": "source_declared_not_certified"}
d00defc1-9214-4ac5-b05c-c56e42140316	d4783698-ae56-4533-b6ce-bab50e68ca9b	12	6539865817f0094fb2730ca7e2cf253e35a0c91f46e76b0fe24cd223b0f9a7be	\N	17fba5632e8d0428ef2194b6758001cd3805595a7021ab0ab8eca010a36b1f82	7c99aa26-bd79-4af6-b3a6-c12d584a74a3	1aa63836-efcd-4e55-80f3-55e1371df090	applied	{"identity": {"external_customer_id": "BAOVE-011", "source_system": "kaggle-v1-bao-ve"}, "customer_action": "matched", "snapshot_action": "reused", "missing_features": [], "input_data": {"Age": 43.0, "Average_Order_Value": 96.62, "Cart_Abandonment_Rate": 63.1, "Churned": 0.0, "City": "Adelaide", "Country": "Australia", "Credit_Balance": 1549.0, "Customer_Service_Calls": 5.0, "Days_Since_Last_Purchase": 65.0, "Discount_Usage_Rate": 30.3, "Email_Open_Rate": 6.3, "Gender": "Male", "Lifetime_Value": 824.37, "Login_Frequency": 13.0, "Membership_Years": 3.4, "Mobile_App_Usage": 19.4, "Pages_Per_Session": 11.2, "Payment_Method_Diversity": 2.0, "Product_Reviews_Written": 3.0, "Returns_Rate": 6.7, "Session_Duration_Avg": 26.6, "Signup_Quarter": "Q3", "Social_Media_Engagement_Score": 29.4, "Total_Purchases": 8.0, "Wishlist_Items": 4.0, "captured_at": "2026-11-15T00:00:00Z", "currency": null, "external_id": "BAOVE-011", "observation_end": null, "observation_start": null, "source": "kaggle-v1-bao-ve"}, "provenance": "source_declared_not_certified"}
2a2f4b38-7e9d-451c-a0df-ca98d93bc542	d4783698-ae56-4533-b6ce-bab50e68ca9b	13	0b6324ddd0d2684ff17ee0398892cb3a1e35a3fb02a04048d7b68e61b5a68a7e	\N	e5c00563fe4e8d87af646099e93dae5818cd0d3393f8ea6e1b99360023ab610d	512e5df4-5b71-4063-86b2-bf4383fa076c	00df99b7-d3c2-448e-a3cf-136f052188e1	applied	{"identity": {"external_customer_id": "BAOVE-012", "source_system": "kaggle-v1-bao-ve"}, "customer_action": "matched", "snapshot_action": "reused", "missing_features": [], "input_data": {"Age": 42.0, "Average_Order_Value": 178.42, "Cart_Abandonment_Rate": 59.2, "Churned": 0.0, "City": "Phoenix", "Country": "USA", "Credit_Balance": 1549.0, "Customer_Service_Calls": 10.0, "Days_Since_Last_Purchase": 5.0, "Discount_Usage_Rate": 20.279999999999998, "Email_Open_Rate": 3.6, "Gender": "Male", "Lifetime_Value": 1022.78, "Login_Frequency": 3.0, "Membership_Years": 4.7, "Mobile_App_Usage": 16.9, "Pages_Per_Session": 7.4, "Payment_Method_Diversity": 2.0, "Product_Reviews_Written": 3.0, "Returns_Rate": 1.1, "Session_Duration_Avg": 17.7, "Signup_Quarter": "Q4", "Social_Media_Engagement_Score": 8.5, "Total_Purchases": 7.800000000000001, "Wishlist_Items": 1.0, "captured_at": "2026-11-15T00:00:00Z", "currency": null, "external_id": "BAOVE-012", "observation_end": null, "observation_start": null, "source": "kaggle-v1-bao-ve"}, "provenance": "source_declared_not_certified"}
\.


--
-- Data for Name: customer_behavior_snapshots; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.customer_behavior_snapshots (id, customer_id, captured_at, source, age, gender, country, city, membership_years, login_frequency, session_duration_avg, pages_per_session, cart_abandonment_rate, wishlist_items, total_purchases, average_order_value, days_since_last_purchase, discount_usage_rate, returns_rate, email_open_rate, customer_service_calls, product_reviews_written, social_media_engagement_score, mobile_app_usage, payment_method_diversity, lifetime_value, credit_balance, churned, signup_quarter) FROM stdin;
938951c1-b93d-49bd-b2c9-184cc5ba896d	011b60c4-a5a6-407c-af96-b443441fb6c7	2026-10-14 21:41:45.707656+07	video-demo	43	Male	France	Marseille	2.9	14	27.4	6	50.6	3	9	94.72	34	46.4	2	17.9	9	4	16.3	20.8	1	953.33	2278	f	Q1
6c834e26-1dd9-4f96-94fe-e5461edca810	53c9ba41-a255-4a48-a08a-993966fee1e6	2026-10-15 18:42:38.298025+07	video-demo	43	Male	France	Marseille	2.9	14	27.4	6	50.6	3	9	94.72	34	46.4	2	17.9	9	4	16.3	20.8	1	953.33	2278	f	Q1
fca46dbd-af94-4a30-9bf1-eec296bd66f4	4f095c96-ef11-49cc-b387-ecb35bc77068	2026-10-15 19:12:59.223772+07	video-demo-1	43	Male	France	Marseille	2.9	14	27.4	6	50.6	3	9	94.72	34	46.4	2	17.9	9	4	16.3	20.8	1	953.33	2278	f	Q1
4be8ac8a-8a3f-4fd6-9bf8-d0e212ea68e3	57f69d5a-454f-44dc-87e6-ceed37752554	2026-11-05 07:00:00+07	kaggle-v1-demo	43	Male	France	Marseille	2.9	14	27.4	6	50.6	3	9	94.72	34	46.4	2	17.9	9	4	16.3	20.8	1	953.33	2278	f	Q1
d29947f1-3535-4d4f-9c3d-18497bc688b0	8162c657-ebf3-47d3-82c4-311a988bfb5c	2026-11-05 07:00:00+07	kaggle-v1-demo	56	Female	USA	New York	2.6	10	38.4	14.8	41.7	9	15	147.33	47	44.1	5.4	41.4	2	5	85.9	31	3	2340.92	2674	f	Q1
c856127a-ada0-4519-8f49-0e0698fa3111	dd4e4b7a-6abc-4f13-9248-5a97d610173d	2026-11-05 07:00:00+07	kaggle-v1-demo	35	Male	Japan	Tokyo	3.5	6	21.9	6.9	74.4	0	12	190.97	29	60.2	11	16	8	2	14.3	11.2	2	1995.43	2418	t	Q1
fcbf66a3-0563-4767-a279-3b75f0ae4a3e	5296c492-d639-49b2-b079-ffd975e6fede	2026-11-05 07:00:00+07	kaggle-v1-demo	56	Male	Germany	Berlin	1.9	24	46.4	13.9	36.2	5	20	169.58	10	27.8	5.5	35.5	4	6	68.8	42.9	5	3003.57	2657	f	Q1
aceae448-736d-4822-a224-149441d67c08	160f6589-9281-4c66-9e34-5e34d959e368	2026-11-05 07:00:00+07	kaggle-v1-demo	32	Male	UK	Glasgow	0.9	0	12.3	2.9	73.5	0	5	118	23	46.2	5.1	0	11	2	17	8	1	599.41	498	t	Q2
659f1dda-79b9-4971-9f4c-ffe36f9acb38	2f53e95b-d728-4eb3-a08e-a0b9525c3ca2	2026-11-05 07:00:00+07	kaggle-v1-demo	32	Female	Germany	Munich	0.6	11	12.1	5.6	77.2	0	5	78.88	36	72	4.8	4	7	1	0	17.7	2	335.92	1369	t	Q3
41983682-1ec7-4897-a67e-54c50942bf28	163739c8-fa6b-4787-9998-ee64f036abb0	2026-11-05 07:00:00+07	kaggle-v1-demo	18	Female	France	Paris	3.7	14	33.5	10.3	48.4	2	15	123	8	40	3.7	16.1	6	4	28.3	23.3	3	1618.51	3624	f	Q1
efdea114-ea80-4b5c-94d2-0590544d3ea0	e7cab491-86a0-487f-b40e-5e5b6d6b2c5d	2026-11-05 07:00:00+07	kaggle-v1-demo	31	Female	USA	New York	1.4	24	50.8	18	44	5	18	91.92	55	83.8	2.5	45	4	5	81.6	26.5	1	1692.54	2564	f	Q3
ee6ad2c4-a96e-4ea9-afb5-bb039b1c2629	4efac273-318c-4742-b381-e07a7d4d63d0	2026-11-05 07:00:00+07	kaggle-v1-demo	25	Female	Canada	Ottawa	0.9	4	12.4	3.7	68.5	1	4	116.39	78	42.6	7	0	9	1	0	15.5	1	503.26	1048	f	Q3
8132853b-d363-452e-802b-c33606f6c154	e1152b08-1d0a-42b5-b820-542c6a1be3bb	2026-11-05 07:00:00+07	kaggle-v1-demo	27	Female	India	Bangalore	2	0	20.3	9.8	59.8	2	11	103.12	5	6.5	18.6	12.5	4	0	3.4	17.5	3	1096.88	54	f	Q2
3ea17821-fe0c-467b-8ee4-d8a1716c8db4	727ec9c1-79ad-4c07-acfe-8daf9690fb2c	2026-11-15 07:00:00+07	kaggle-v1-bao-ve	56	Female	USA	New York	2.6	10	38.4	14.8	41.7	9	15	147.33	47	44.1	5.4	41.4	2	5	85.9	31	3	2340.92	2674	f	Q1
a06ed6d7-559b-4f15-ba70-719f1a96648d	ca7c6bc9-5e44-424f-8fe2-75c5b00201a0	2026-11-15 07:00:00+07	kaggle-v1-bao-ve	55	Female	India	Bangalore	1.2	24	50.3	16	25.2	9	24	108.52	4	33	11.6	72.1	1	5	76.7	37.8	1	3063.29	4561	f	Q1
32464d68-d517-4fda-9cdb-e04204f8efe9	0a9ab69a-3e34-41bd-91bd-2ff1a9611e13	2026-11-15 07:00:00+07	kaggle-v1-bao-ve	34	Male	Japan	Yokohama	4.4	12	42.1	13.3	38.3	8	17	65.22	10	32.3	5.9	23.8	1	2	38.8	28.8	2	1226.33	1889	f	Q3
71a3fc19-abba-49d9-a693-c3acaed40168	31c63922-7346-414c-8346-deae09984763	2026-11-15 07:00:00+07	kaggle-v1-bao-ve	42	Male	USA	Chicago	3.4	7	25.9	12.2	62.5	4	10	150.38	24	71.3	7	23.3	2	2	4.7	18.9	2	1345.57	2656	f	Q2
fdf9215b-960a-44d3-98f9-6683a2c590f7	946fe89f-61ca-41a3-b193-878471e439c2	2026-11-15 07:00:00+07	kaggle-v1-bao-ve	37	Male	Germany	Munich	7.5	29	48.9	15.9	27.8	14	22	134.1	34	22.2	5.1	33.6	1	10	59	39.6	5	3367.15	2544	t	Q3
85d60df5-5232-449c-ad18-0f0fb46bf583	60ecc394-6aa6-491e-a094-cbb3dc6a48e9	2026-11-15 07:00:00+07	kaggle-v1-bao-ve	40	Male	USA	Phoenix	3.2	18	27	9.9	51.5	1	11	145.04	68	62	7.9	0	1	1	27.2	7.5	2	1506.54	2966	f	Q3
e6c8f581-ea52-4197-b14d-bde1a5f4cec9	35a65074-15a4-471a-b62d-560656bb7cc0	2026-11-15 07:00:00+07	kaggle-v1-bao-ve	36	Male	USA	Chicago	1.4	0	33	5.1	75.1	4	6	199.48	43	47.8	2.1	11.6	6	1	23.9	19.9	3	1133.62	1416	f	Q2
f137ef20-f5f3-4ab3-adaa-a3b95bde5caa	dbd047a8-f3e5-475c-8acd-b009407de2e1	2026-11-15 07:00:00+07	kaggle-v1-bao-ve	41	Male	USA	Chicago	3.4	23	44.6	14.2	46.8	5	15	111.93	48	25.1	17	39.2	4	1	35.2	27.8	1	1862.75	2442	f	Q3
cdc5c880-352e-40d1-8c7d-a993b2b39df5	45a52008-364c-4668-b267-e9a1e68cb835	2026-11-15 07:00:00+07	kaggle-v1-bao-ve	51	Female	Germany	Hamburg	1.7	8	24	6.5	51.5	5	12	125.34	34	55.7	3.1	37.8	3	1	69	11.5	2	1651.78	1607	f	Q1
01dba1fc-b97c-4186-be58-cd7777eb89a5	f770ce3f-2c85-41d6-b30e-55e2cde77409	2026-11-15 07:00:00+07	kaggle-v1-bao-ve	47	Female	UK	Glasgow	2.1	9	16.3	5.1	62.3	5	6	121.45	1	21.6	2.7	12.8	8	2	10	15.5	1	725.92	3482	f	Q3
1aa63836-efcd-4e55-80f3-55e1371df090	7c99aa26-bd79-4af6-b3a6-c12d584a74a3	2026-11-15 07:00:00+07	kaggle-v1-bao-ve	43	Male	Australia	Adelaide	3.4	13	26.6	11.2	63.1	4	8	96.62	65	30.3	6.7	6.3	5	3	29.4	19.4	2	824.37	1549	f	Q3
00df99b7-d3c2-448e-a3cf-136f052188e1	512e5df4-5b71-4063-86b2-bf4383fa076c	2026-11-15 07:00:00+07	kaggle-v1-bao-ve	42	Male	USA	Phoenix	4.7	3	17.7	7.4	59.2	1	7.800000000000001	178.42	5	20.279999999999998	1.1	3.6	10	3	8.5	16.9	2	1022.78	1549	f	Q4
1348daf1-bd90-452d-a65e-97184357ea76	508fb791-a1f7-4b16-b012-3d62d176bde6	2026-11-15 07:00:00+07	kaggle-v1-bao-ve	56	Female	USA	New York	2.6	10	38.4	14.8	41.7	9	15	147.33	47	44.1	5.4	41.4	2	5	85.9	31	3	2340.92	2674	f	Q1
5468500a-0345-4c3e-947f-117d267b4496	4ccfd8f9-e500-4706-973a-3bbd09e63e74	2026-11-15 07:00:00+07	kaggle-v1-bao-ve	34	Male	Japan	Yokohama	4.4	12	42.1	13.3	38.3	8	17	65.22	10	32.3	5.9	23.8	1	2	38.8	28.8	2	1226.33	1889	f	Q3
\.


--
-- Data for Name: customer_source_identities; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.customer_source_identities (id, source_system, external_customer_id, customer_id, created_at) FROM stdin;
f85e5b19-a505-47d9-8321-49678bc4646e	kaggle-v1-demo	KAGGLE-V1-ROW-000001	57f69d5a-454f-44dc-87e6-ceed37752554	2026-11-05 09:27:28.805083+07
fa4d4f49-fc44-46e2-b83d-7843bc842220	kaggle-v1-demo	KAGGLE-V1-ROW-000004	8162c657-ebf3-47d3-82c4-311a988bfb5c	2026-11-05 09:27:28.805083+07
4ada8c58-43a4-49be-ab4b-e161c3d75d28	kaggle-v1-demo	KAGGLE-V1-ROW-000006	dd4e4b7a-6abc-4f13-9248-5a97d610173d	2026-11-05 09:27:28.805083+07
738126b4-4d0b-47a3-bd7d-0091573a92d9	kaggle-v1-demo	KAGGLE-V1-ROW-000007	5296c492-d639-49b2-b079-ffd975e6fede	2026-11-05 09:27:28.805083+07
d5bb3a3f-0799-4d25-8e34-465834c0cd4e	kaggle-v1-demo	KAGGLE-V1-ROW-000011	160f6589-9281-4c66-9e34-5e34d959e368	2026-11-05 09:27:28.805083+07
265f9885-7679-4efb-ba7b-3217b61e5535	kaggle-v1-demo	KAGGLE-V1-ROW-000012	2f53e95b-d728-4eb3-a08e-a0b9525c3ca2	2026-11-05 09:27:28.805083+07
2c8a444d-328d-4094-8526-0c1ec951012a	kaggle-v1-demo	KAGGLE-V1-ROW-000015	163739c8-fa6b-4787-9998-ee64f036abb0	2026-11-05 09:27:28.805083+07
f08217ec-c6e9-4636-8f0a-c88aad0a97af	kaggle-v1-demo	KAGGLE-V1-ROW-000016	e7cab491-86a0-487f-b40e-5e5b6d6b2c5d	2026-11-05 09:27:28.805083+07
a0a58ddd-c7b8-431f-9bd0-092ea4a6fa8e	kaggle-v1-demo	KAGGLE-V1-ROW-000017	4efac273-318c-4742-b381-e07a7d4d63d0	2026-11-05 09:27:28.805083+07
e17f27a8-d9f9-48a5-ada7-d5cd4ba81c97	kaggle-v1-demo	KAGGLE-V1-ROW-000019	e1152b08-1d0a-42b5-b820-542c6a1be3bb	2026-11-05 09:27:28.805083+07
2207b703-bbe9-4a3a-85cf-98bc95d3199b	kaggle-v1-bao-ve	BAOVE-001	727ec9c1-79ad-4c07-acfe-8daf9690fb2c	2026-11-16 19:13:54.054572+07
610b6bba-87ee-449c-92ba-916f1068fe12	kaggle-v1-bao-ve	BAOVE-002	ca7c6bc9-5e44-424f-8fe2-75c5b00201a0	2026-11-16 19:13:54.054572+07
a4048efe-403f-4f3a-aa9d-9e3f7cc9d65a	kaggle-v1-bao-ve	BAOVE-003	0a9ab69a-3e34-41bd-91bd-2ff1a9611e13	2026-11-16 19:13:54.054572+07
0e494f84-9772-4256-9e59-dad931edec01	kaggle-v1-bao-ve	BAOVE-008	31c63922-7346-414c-8346-deae09984763	2026-11-16 19:17:11.080923+07
f6fa1299-02d2-487d-befc-51759554962b	kaggle-v1-bao-ve	BAOVE-004	946fe89f-61ca-41a3-b193-878471e439c2	2026-11-19 19:31:56.013093+07
71e6a7a1-1941-4d65-a672-4ca1c3d8fb84	kaggle-v1-bao-ve	BAOVE-005	60ecc394-6aa6-491e-a094-cbb3dc6a48e9	2026-11-19 19:31:56.013093+07
2140eea1-debc-4819-b7e8-1bfb869f0935	kaggle-v1-bao-ve	BAOVE-006	35a65074-15a4-471a-b62d-560656bb7cc0	2026-11-19 19:31:56.013093+07
ece7a978-b3cd-49f0-96e6-4200b8c2de29	kaggle-v1-bao-ve	BAOVE-007	dbd047a8-f3e5-475c-8acd-b009407de2e1	2026-11-19 19:31:56.013093+07
d1ca86b5-b99c-4737-adf9-6eb8c96c5e67	kaggle-v1-bao-ve	BAOVE-009	45a52008-364c-4668-b267-e9a1e68cb835	2026-11-19 19:31:56.013093+07
9addbd52-6418-4fa8-ae05-1f2b08d7e6e0	kaggle-v1-bao-ve	BAOVE-010	f770ce3f-2c85-41d6-b30e-55e2cde77409	2026-11-19 19:31:56.013093+07
c9889a84-b289-4355-bf40-4bd0d6facb5c	kaggle-v1-bao-ve	BAOVE-011	7c99aa26-bd79-4af6-b3a6-c12d584a74a3	2026-11-19 19:31:56.013093+07
36130139-d50c-4f63-b102-94c87c787c06	kaggle-v1-bao-ve	BAOVE-012	512e5df4-5b71-4063-86b2-bf4383fa076c	2026-11-19 19:31:56.013093+07
575df8cb-7ea1-4e70-a083-d4580027b5bd	kaggle-v1-bao-ve	LOI-001	508fb791-a1f7-4b16-b012-3d62d176bde6	2026-11-20 18:12:22.821204+07
d3400ec6-d076-463d-97e5-b191b849c0b3	kaggle-v1-bao-ve	LOI-003	4ccfd8f9-e500-4706-973a-3bbd09e63e74	2026-11-20 18:12:22.821204+07
\.


--
-- Data for Name: customers; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.customers (id, external_id, is_active, created_at, updated_at, deactivated_at) FROM stdin;
011b60c4-a5a6-407c-af96-b443441fb6c7	VIDEO-DEMO-001	t	2026-10-14 21:41:00.082683+07	2026-10-14 21:41:00.082683+07	\N
53c9ba41-a255-4a48-a08a-993966fee1e6	VIDEO-DEMO-001-UPDATED	f	2026-10-15 18:41:44.836284+07	2026-10-15 19:06:49.67485+07	2026-10-15 19:06:49.67492+07
4f095c96-ef11-49cc-b387-ecb35bc77068	DEMO-001-UPDATED	f	2026-10-15 19:12:20.491325+07	2026-10-15 19:18:55.293228+07	2026-10-15 19:18:55.295317+07
f2c094ac-8cd5-41e4-8eaf-38de5af200db	01	t	2026-10-27 20:15:23.193836+07	2026-10-27 20:15:54.673407+07	\N
4499f2e8-8af2-4274-94aa-04b64c657660	02	t	2026-10-27 20:33:23.03597+07	2026-10-27 20:33:33.801019+07	\N
57f69d5a-454f-44dc-87e6-ceed37752554	bulk:af1e7c8ca879c20178fe063363edc30a0e5c58843dd6b8fc55bf81d6ec5b22b7	t	2026-11-05 09:27:28.805083+07	2026-11-05 09:27:28.805083+07	\N
8162c657-ebf3-47d3-82c4-311a988bfb5c	bulk:a3d26eb22e18bb9d692d47f0d960f0fa2c4605f9d2115b8a668b6b29f6aeb129	t	2026-11-05 09:27:28.805083+07	2026-11-05 09:27:28.805083+07	\N
dd4e4b7a-6abc-4f13-9248-5a97d610173d	bulk:b0af54d897f0a32e76422939e5b9c208ffe50afa33e4d553fd12e6e8172f7a7c	t	2026-11-05 09:27:28.805083+07	2026-11-05 09:27:28.805083+07	\N
5296c492-d639-49b2-b079-ffd975e6fede	bulk:75cd64aa7a6c8efd9e354f5672bdeb1e104e344860fd1903818e693535095c6c	t	2026-11-05 09:27:28.805083+07	2026-11-05 09:27:28.805083+07	\N
160f6589-9281-4c66-9e34-5e34d959e368	bulk:24a5b9df256d0dccca5f500dc94c1a3b02d10d47cb1e356ddaa25d29a08b0aaa	t	2026-11-05 09:27:28.805083+07	2026-11-05 09:27:28.805083+07	\N
2f53e95b-d728-4eb3-a08e-a0b9525c3ca2	bulk:86fc639b289c4c5c988649a910a2536581645f4ea5effef834a3d2a437bc99a8	t	2026-11-05 09:27:28.805083+07	2026-11-05 09:27:28.805083+07	\N
163739c8-fa6b-4787-9998-ee64f036abb0	bulk:fcea4467bc396aaacab06a68ae33c100997ea10d92c725e4a7bea036b6bdd3a8	t	2026-11-05 09:27:28.805083+07	2026-11-05 09:27:28.805083+07	\N
e7cab491-86a0-487f-b40e-5e5b6d6b2c5d	bulk:b236df944853107a4cd9a5f9d596c9fae710799c34f03447011c7c89e5faec52	t	2026-11-05 09:27:28.805083+07	2026-11-05 09:27:28.805083+07	\N
4efac273-318c-4742-b381-e07a7d4d63d0	bulk:972005ac3a4905cb0884f31f4a8177c241fb3ae55a17328fe97dd450132893f0	t	2026-11-05 09:27:28.805083+07	2026-11-05 09:27:28.805083+07	\N
e1152b08-1d0a-42b5-b820-542c6a1be3bb	bulk:b9ae8dac11424d22a59034c94199d4b079d904f2c1069872759883ce4df2200c	t	2026-11-05 09:27:28.805083+07	2026-11-05 09:27:28.805083+07	\N
727ec9c1-79ad-4c07-acfe-8daf9690fb2c	bulk:58026472c77358ee603f12ee115c1d428494fcc28797285930a0a0bcac48df4b	t	2026-11-16 19:13:54.054572+07	2026-11-16 19:13:54.054572+07	\N
ca7c6bc9-5e44-424f-8fe2-75c5b00201a0	bulk:0ef4a679ba74d0cd15f919730506bafefac571c48f6583975a52113fea21f31c	t	2026-11-16 19:13:54.054572+07	2026-11-16 19:13:54.054572+07	\N
0a9ab69a-3e34-41bd-91bd-2ff1a9611e13	bulk:8f2bd2dc2ebade8e9c42393d4295a5cd4311380e7a08bf30925059d2083bb56d	t	2026-11-16 19:13:54.054572+07	2026-11-16 19:13:54.054572+07	\N
31c63922-7346-414c-8346-deae09984763	bulk:ceb2f40161a24167770e0c9c97e17fc821371a6996882e69492db64565a96631	t	2026-11-16 19:17:11.080923+07	2026-11-16 19:17:11.080923+07	\N
946fe89f-61ca-41a3-b193-878471e439c2	bulk:0ccfd047e5e45f30bb592c1878990b211e56fcfdce5b5f7aad76f51238565b1e	t	2026-11-19 19:31:56.013093+07	2026-11-19 19:31:56.013093+07	\N
60ecc394-6aa6-491e-a094-cbb3dc6a48e9	bulk:0dcab3643a80bbd0bb8810c44621efd37d25c6f0f1d516a5b890e7bf2a879aba	t	2026-11-19 19:31:56.013093+07	2026-11-19 19:31:56.013093+07	\N
35a65074-15a4-471a-b62d-560656bb7cc0	bulk:548c856641c5c2eefe9d0c349eb67f17dfe3cba5a1d04666c4d88bd9b007e3b0	t	2026-11-19 19:31:56.013093+07	2026-11-19 19:31:56.013093+07	\N
dbd047a8-f3e5-475c-8acd-b009407de2e1	bulk:7a6a593283ec94dcfbe2af49215736ccf688ced7ce552758a3dd605a7811417f	t	2026-11-19 19:31:56.013093+07	2026-11-19 19:31:56.013093+07	\N
45a52008-364c-4668-b267-e9a1e68cb835	bulk:39e80ebb2693d17a56cea5cfe7895ca3ed7b2fe2d67408bbb4008203f9ac4a11	t	2026-11-19 19:31:56.013093+07	2026-11-19 19:31:56.013093+07	\N
f770ce3f-2c85-41d6-b30e-55e2cde77409	bulk:e44a6b26965170bae89c6aef9d0232946ed6db912b3e9a442b89040a861cedc7	t	2026-11-19 19:31:56.013093+07	2026-11-19 19:31:56.013093+07	\N
7c99aa26-bd79-4af6-b3a6-c12d584a74a3	bulk:de65b7364e9c7bda852515872d4121d021e939333e6e08bd19362792559e2b16	t	2026-11-19 19:31:56.013093+07	2026-11-19 19:31:56.013093+07	\N
512e5df4-5b71-4063-86b2-bf4383fa076c	bulk:834ccc60340c5aadf2ffc823158edd85854adaaef04f06bf9ebcf56edb9d82dc	t	2026-11-19 19:31:56.013093+07	2026-11-19 19:31:56.013093+07	\N
508fb791-a1f7-4b16-b012-3d62d176bde6	bulk:2b42cb2a24cdd4f2ab0a6806becf4837355673a7c94690ed89d5ebb3abd884fb	t	2026-11-20 18:12:22.821204+07	2026-11-20 18:12:22.821204+07	\N
4ccfd8f9-e500-4706-973a-3bbd09e63e74	bulk:e12afc4d8ed04d343fd1448528c5a87927b08953865268b338a27ab7865cfce7	t	2026-11-20 18:12:22.821204+07	2026-11-20 18:12:22.821204+07	\N
\.


--
-- Data for Name: ml_models; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.ml_models (id, name, task, algorithm, version, artifact_path, metadata_path, artifact_checksum, metadata_json, is_active, created_at) FROM stdin;
86345ea6-8cec-4e7a-8b4b-8b5b1d45ddbd	purchase-level-xgboost	classification	XGBoost	1.0.0	models\\purchase_level_xgboost_pipeline.joblib	models\\purchase_level_xgboost_metadata.json	1bbde6767f3b14bc5d29da3c848e53256363638f34e3263be0238e950e527e8f	{"task": "Purchase Level Classification", "target": "Purchase_Level", "model_name": "XGBoost", "cv_macro_f1": 0.866687, "random_state": 42, "test_metrics": {"accuracy": 0.8748, "macro_f1": 0.87184, "macro_recall": 0.871391, "macro_precision": 0.872877}, "class_mapping": {"0": "Low", "1": "Medium", "2": "High"}, "input_features": ["Age", "Gender", "Country", "City", "Membership_Years", "Login_Frequency", "Session_Duration_Avg", "Pages_Per_Session", "Cart_Abandonment_Rate", "Wishlist_Items", "Average_Order_Value", "Days_Since_Last_Purchase", "Discount_Usage_Rate", "Returns_Rate", "Email_Open_Rate", "Customer_Service_Calls", "Product_Reviews_Written", "Social_Media_Engagement_Score", "Mobile_App_Usage", "Payment_Method_Diversity", "Lifetime_Value", "Credit_Balance", "Churned", "Signup_Quarter"], "hyperparameters": {"gamma": 0.1, "max_depth": 3, "subsample": 0.9, "n_estimators": 200, "learning_rate": 0.2, "colsample_bytree": 1.0, "min_child_weight": 5}, "excluded_features": ["Total_Purchases"]}	t	2026-10-13 20:18:12.444605+07
8b0b7247-65bc-4660-9b61-2ed6298820f6	customer-segmentation-kmeans	segmentation	K-Means	1.0.0	models\\customer_segmentation_kmeans_pipeline.joblib	models\\customer_segmentation_kmeans_metadata.json	5ab101792571047b832c82d9b7e64390b158b788b140486742947bfbe796d7d1	{"metrics": {"inertia": 295590.59317450825, "silhouette": 0.1689244002804271, "davies_bouldin": 1.766266360700646, "calinski_harabasz": 17239.687356775547}, "features": ["Login_Frequency", "Session_Duration_Avg", "Pages_Per_Session", "Cart_Abandonment_Rate", "Wishlist_Items", "Total_Purchases", "Average_Order_Value", "Days_Since_Last_Purchase", "Discount_Usage_Rate", "Mobile_App_Usage"], "algorithm": "KMeans", "model_name": "KMeans Customer Segmentation", "n_clusters": 3, "random_state": 42, "cluster_names": {"0": "Khách hàng tích cực", "1": "Khách hàng ít tương tác", "2": "Khách hàng tiềm năng"}, "preprocessing": {"method": "Quantile Clipping + StandardScaler", "clip_bounds": {"Total_Purchases": {"lower": 2.0, "upper": 31.200000000000003}, "Average_Order_Value": {"lower": 45.281800000000004, "upper": 252.02409999999998}}, "clipped_features": ["Total_Purchases", "Average_Order_Value"]}}	t	2026-10-13 20:18:12.444605+07
\.


--
-- Data for Name: prediction_results; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.prediction_results (id, run_id, model_id, customer_id, behavior_snapshot_id, input_features, predicted_class, purchase_level, probability_low, probability_medium, probability_high, created_at) FROM stdin;
84385dae-a864-47c6-a02b-e073377180c5	897f76a7-37f0-4d5e-b474-efe61dfecbf1	86345ea6-8cec-4e7a-8b4b-8b5b1d45ddbd	011b60c4-a5a6-407c-af96-b443441fb6c7	938951c1-b93d-49bd-b2c9-184cc5ba896d	{"Age": 43, "City": "Marseille", "Gender": "Male", "Churned": 0, "Country": "France", "Returns_Rate": 2, "Credit_Balance": 2278, "Lifetime_Value": 953.33, "Signup_Quarter": "Q1", "Wishlist_Items": 3, "Email_Open_Rate": 17.9, "Login_Frequency": 14, "Membership_Years": 2.9, "Mobile_App_Usage": 20.8, "Pages_Per_Session": 6, "Average_Order_Value": 94.72, "Discount_Usage_Rate": 46.4, "Session_Duration_Avg": 27.4, "Cart_Abandonment_Rate": 50.6, "Customer_Service_Calls": 9, "Product_Reviews_Written": 4, "Days_Since_Last_Purchase": 34, "Payment_Method_Diversity": 1, "Social_Media_Engagement_Score": 16.3}	0	Low	0.5996882915496826	0.39808565378189087	0.0022260083351284266	2026-10-14 21:44:26.970871+07
cb164b73-0655-4f01-a7e0-6c1bbad2afeb	d7f0a944-6a63-45e6-b6d9-15bab25026cc	86345ea6-8cec-4e7a-8b4b-8b5b1d45ddbd	53c9ba41-a255-4a48-a08a-993966fee1e6	6c834e26-1dd9-4f96-94fe-e5461edca810	{"Age": 43, "City": "Marseille", "Gender": "Male", "Churned": 0, "Country": "France", "Returns_Rate": 2, "Credit_Balance": 2278, "Lifetime_Value": 953.33, "Signup_Quarter": "Q1", "Wishlist_Items": 3, "Email_Open_Rate": 17.9, "Login_Frequency": 14, "Membership_Years": 2.9, "Mobile_App_Usage": 20.8, "Pages_Per_Session": 6, "Average_Order_Value": 94.72, "Discount_Usage_Rate": 46.4, "Session_Duration_Avg": 27.4, "Cart_Abandonment_Rate": 50.6, "Customer_Service_Calls": 9, "Product_Reviews_Written": 4, "Days_Since_Last_Purchase": 34, "Payment_Method_Diversity": 1, "Social_Media_Engagement_Score": 16.3}	0	Low	0.5996882915496826	0.39808565378189087	0.0022260083351284266	2026-10-15 18:52:53.146433+07
3add5106-1f57-4c64-8f3c-b73a577c8fc1	c1549e15-6dd3-453c-b33b-93b0790ce994	86345ea6-8cec-4e7a-8b4b-8b5b1d45ddbd	4f095c96-ef11-49cc-b387-ecb35bc77068	fca46dbd-af94-4a30-9bf1-eec296bd66f4	{"Age": 43, "City": "Marseille", "Gender": "Male", "Churned": 0, "Country": "France", "Returns_Rate": 2, "Credit_Balance": 2278, "Lifetime_Value": 953.33, "Signup_Quarter": "Q1", "Wishlist_Items": 3, "Email_Open_Rate": 17.9, "Login_Frequency": 14, "Membership_Years": 2.9, "Mobile_App_Usage": 20.8, "Pages_Per_Session": 6, "Average_Order_Value": 94.72, "Discount_Usage_Rate": 46.4, "Session_Duration_Avg": 27.4, "Cart_Abandonment_Rate": 50.6, "Customer_Service_Calls": 9, "Product_Reviews_Written": 4, "Days_Since_Last_Purchase": 34, "Payment_Method_Diversity": 1, "Social_Media_Engagement_Score": 16.3}	0	Low	0.5996882915496826	0.39808565378189087	0.0022260083351284266	2026-10-15 19:14:04.343712+07
a95f6e55-efce-4fc2-9a21-8788ed354789	7f64f5a1-2b03-4d7c-af3f-a4990a08f6d1	86345ea6-8cec-4e7a-8b4b-8b5b1d45ddbd	011b60c4-a5a6-407c-af96-b443441fb6c7	\N	{"Age": 43.0, "City": "Marseille", "Gender": "Male", "Churned": 0.0, "Country": "France", "Returns_Rate": 2.0, "Credit_Balance": 2278.0, "Lifetime_Value": 953.33, "Signup_Quarter": "Q1", "Wishlist_Items": 5.0, "Email_Open_Rate": 17.9, "Login_Frequency": 17.0, "Membership_Years": 2.9, "Mobile_App_Usage": 20.8, "Pages_Per_Session": 8.0, "Average_Order_Value": 94.72, "Discount_Usage_Rate": 46.4, "Session_Duration_Avg": 27.4, "Cart_Abandonment_Rate": 50.6, "Customer_Service_Calls": 9.0, "Product_Reviews_Written": 4.0, "Days_Since_Last_Purchase": 38.0, "Payment_Method_Diversity": 1.0, "Social_Media_Engagement_Score": 16.3}	0	Low	0.5265456438064575	0.4705210328102112	0.002933305921033025	2026-10-27 20:22:15.759199+07
681a5fd5-95ad-4d16-8ec6-d35c0c6b1473	66f35d16-eb81-40a5-9a82-e6683b80118e	86345ea6-8cec-4e7a-8b4b-8b5b1d45ddbd	011b60c4-a5a6-407c-af96-b443441fb6c7	\N	{"Age": 43.0, "City": "Marseille", "Gender": "Male", "Churned": 0.0, "Country": "France", "Returns_Rate": 2.0, "Credit_Balance": 2278.0, "Lifetime_Value": 953.33, "Signup_Quarter": "Q1", "Wishlist_Items": 3.0, "Email_Open_Rate": 55.0, "Login_Frequency": 18.0, "Membership_Years": 3.0, "Mobile_App_Usage": 20.8, "Pages_Per_Session": 9.0, "Average_Order_Value": 94.72, "Discount_Usage_Rate": 46.4, "Session_Duration_Avg": 27.4, "Cart_Abandonment_Rate": 50.6, "Customer_Service_Calls": 9.0, "Product_Reviews_Written": 4.0, "Days_Since_Last_Purchase": 34.0, "Payment_Method_Diversity": 1.0, "Social_Media_Engagement_Score": 16.3}	1	Medium	0.40425243973731995	0.5921616554260254	0.0035859174095094204	2026-10-27 20:31:09.965445+07
ea36b97d-0b35-4c8a-832a-269bf45c6269	5186dd01-8b18-4abc-b730-6b65cb3de23e	86345ea6-8cec-4e7a-8b4b-8b5b1d45ddbd	163739c8-fa6b-4787-9998-ee64f036abb0	41983682-1ec7-4897-a67e-54c50942bf28	{"Age": 18.0, "City": "Paris", "Gender": "Female", "Churned": 0.0, "Country": "France", "Returns_Rate": 3.7, "Credit_Balance": 3624.0, "Lifetime_Value": 1618.51, "Signup_Quarter": "Q1", "Wishlist_Items": 2.0, "Email_Open_Rate": 16.1, "Login_Frequency": 14.0, "Membership_Years": 3.7, "Mobile_App_Usage": 23.3, "Pages_Per_Session": 10.3, "Average_Order_Value": 123.0, "Discount_Usage_Rate": 40.0, "Session_Duration_Avg": 33.5, "Cart_Abandonment_Rate": 48.4, "Customer_Service_Calls": 6.0, "Product_Reviews_Written": 4.0, "Days_Since_Last_Purchase": 8.0, "Payment_Method_Diversity": 3.0, "Social_Media_Engagement_Score": 28.3}	1	Medium	0.01515610609203577	0.9122533202171326	0.07259061187505722	2026-11-05 13:38:02.871688+07
93252cef-6c5b-47e6-928f-affac50a73e6	5186dd01-8b18-4abc-b730-6b65cb3de23e	86345ea6-8cec-4e7a-8b4b-8b5b1d45ddbd	57f69d5a-454f-44dc-87e6-ceed37752554	4be8ac8a-8a3f-4fd6-9bf8-d0e212ea68e3	{"Age": 43.0, "City": "Marseille", "Gender": "Male", "Churned": 0.0, "Country": "France", "Returns_Rate": 2.0, "Credit_Balance": 2278.0, "Lifetime_Value": 953.33, "Signup_Quarter": "Q1", "Wishlist_Items": 3.0, "Email_Open_Rate": 17.9, "Login_Frequency": 14.0, "Membership_Years": 2.9, "Mobile_App_Usage": 20.8, "Pages_Per_Session": 6.0, "Average_Order_Value": 94.72, "Discount_Usage_Rate": 46.4, "Session_Duration_Avg": 27.4, "Cart_Abandonment_Rate": 50.6, "Customer_Service_Calls": 9.0, "Product_Reviews_Written": 4.0, "Days_Since_Last_Purchase": 34.0, "Payment_Method_Diversity": 1.0, "Social_Media_Engagement_Score": 16.3}	0	Low	0.5996882915496826	0.39808565378189087	0.0022260083351284266	2026-11-05 13:38:02.871688+07
26ffc057-dd44-420b-973a-1d1fb9bcb817	5186dd01-8b18-4abc-b730-6b65cb3de23e	86345ea6-8cec-4e7a-8b4b-8b5b1d45ddbd	2f53e95b-d728-4eb3-a08e-a0b9525c3ca2	659f1dda-79b9-4971-9f4c-ffe36f9acb38	{"Age": 32.0, "City": "Munich", "Gender": "Female", "Churned": 1.0, "Country": "Germany", "Returns_Rate": 4.8, "Credit_Balance": 1369.0, "Lifetime_Value": 335.92, "Signup_Quarter": "Q3", "Wishlist_Items": 0.0, "Email_Open_Rate": 4.0, "Login_Frequency": 11.0, "Membership_Years": 0.6, "Mobile_App_Usage": 17.7, "Pages_Per_Session": 5.6, "Average_Order_Value": 78.88, "Discount_Usage_Rate": 72.0, "Session_Duration_Avg": 12.1, "Cart_Abandonment_Rate": 77.2, "Customer_Service_Calls": 7.0, "Product_Reviews_Written": 1.0, "Days_Since_Last_Purchase": 36.0, "Payment_Method_Diversity": 2.0, "Social_Media_Engagement_Score": 0.0}	0	Low	0.9999018907546997	7.86568780313246e-05	1.9459548639133573e-05	2026-11-05 13:38:02.871688+07
79cf2c0c-f5f3-4652-b157-511ccf5dab66	5186dd01-8b18-4abc-b730-6b65cb3de23e	86345ea6-8cec-4e7a-8b4b-8b5b1d45ddbd	e1152b08-1d0a-42b5-b820-542c6a1be3bb	8132853b-d363-452e-802b-c33606f6c154	{"Age": 27.0, "City": "Bangalore", "Gender": "Female", "Churned": 0.0, "Country": "India", "Returns_Rate": 18.6, "Credit_Balance": 54.0, "Lifetime_Value": 1096.88, "Signup_Quarter": "Q2", "Wishlist_Items": 2.0, "Email_Open_Rate": 12.5, "Login_Frequency": 0.0, "Membership_Years": 2.0, "Mobile_App_Usage": 17.5, "Pages_Per_Session": 9.8, "Average_Order_Value": 103.12, "Discount_Usage_Rate": 6.5, "Session_Duration_Avg": 20.3, "Cart_Abandonment_Rate": 59.8, "Customer_Service_Calls": 4.0, "Product_Reviews_Written": 0.0, "Days_Since_Last_Purchase": 5.0, "Payment_Method_Diversity": 3.0, "Social_Media_Engagement_Score": 3.4}	0	Low	0.5745329260826111	0.42089566588401794	0.004571391735225916	2026-11-05 13:38:02.871688+07
c4f37441-9859-4a42-b164-b9c170834e66	5186dd01-8b18-4abc-b730-6b65cb3de23e	86345ea6-8cec-4e7a-8b4b-8b5b1d45ddbd	160f6589-9281-4c66-9e34-5e34d959e368	aceae448-736d-4822-a224-149441d67c08	{"Age": 32.0, "City": "Glasgow", "Gender": "Male", "Churned": 1.0, "Country": "UK", "Returns_Rate": 5.1, "Credit_Balance": 498.0, "Lifetime_Value": 599.41, "Signup_Quarter": "Q2", "Wishlist_Items": 0.0, "Email_Open_Rate": 0.0, "Login_Frequency": 0.0, "Membership_Years": 0.9, "Mobile_App_Usage": 8.0, "Pages_Per_Session": 2.9, "Average_Order_Value": 118.0, "Discount_Usage_Rate": 46.2, "Session_Duration_Avg": 12.3, "Cart_Abandonment_Rate": 73.5, "Customer_Service_Calls": 11.0, "Product_Reviews_Written": 2.0, "Days_Since_Last_Purchase": 23.0, "Payment_Method_Diversity": 1.0, "Social_Media_Engagement_Score": 17.0}	0	Low	0.9999018907546997	9.790472540771589e-05	2.0493271790655854e-07	2026-11-05 13:38:02.871688+07
1f80187f-bcff-4a29-b13d-31a84c37b230	5186dd01-8b18-4abc-b730-6b65cb3de23e	86345ea6-8cec-4e7a-8b4b-8b5b1d45ddbd	dd4e4b7a-6abc-4f13-9248-5a97d610173d	c856127a-ada0-4519-8f49-0e0698fa3111	{"Age": 35.0, "City": "Tokyo", "Gender": "Male", "Churned": 1.0, "Country": "Japan", "Returns_Rate": 11.0, "Credit_Balance": 2418.0, "Lifetime_Value": 1995.43, "Signup_Quarter": "Q1", "Wishlist_Items": 0.0, "Email_Open_Rate": 16.0, "Login_Frequency": 6.0, "Membership_Years": 3.5, "Mobile_App_Usage": 11.2, "Pages_Per_Session": 6.9, "Average_Order_Value": 190.97, "Discount_Usage_Rate": 60.2, "Session_Duration_Avg": 21.9, "Cart_Abandonment_Rate": 74.4, "Customer_Service_Calls": 8.0, "Product_Reviews_Written": 2.0, "Days_Since_Last_Purchase": 29.0, "Payment_Method_Diversity": 2.0, "Social_Media_Engagement_Score": 14.3}	1	Medium	0.4429194927215576	0.5524596571922302	0.00462083937600255	2026-11-05 13:38:02.871688+07
966e22e5-70bc-4f5d-8dc6-9ddb139893ec	5186dd01-8b18-4abc-b730-6b65cb3de23e	86345ea6-8cec-4e7a-8b4b-8b5b1d45ddbd	8162c657-ebf3-47d3-82c4-311a988bfb5c	d29947f1-3535-4d4f-9c3d-18497bc688b0	{"Age": 56.0, "City": "New York", "Gender": "Female", "Churned": 0.0, "Country": "USA", "Returns_Rate": 5.4, "Credit_Balance": 2674.0, "Lifetime_Value": 2340.92, "Signup_Quarter": "Q1", "Wishlist_Items": 9.0, "Email_Open_Rate": 41.4, "Login_Frequency": 10.0, "Membership_Years": 2.6, "Mobile_App_Usage": 31.0, "Pages_Per_Session": 14.8, "Average_Order_Value": 147.33, "Discount_Usage_Rate": 44.1, "Session_Duration_Avg": 38.4, "Cart_Abandonment_Rate": 41.7, "Customer_Service_Calls": 2.0, "Product_Reviews_Written": 5.0, "Days_Since_Last_Purchase": 47.0, "Payment_Method_Diversity": 3.0, "Social_Media_Engagement_Score": 85.9}	2	High	0.00010283983283443376	0.11101213097572327	0.8888850212097168	2026-11-05 13:38:02.871688+07
79b1ff67-8d72-4e60-9fbb-9efdf3bdb2db	5186dd01-8b18-4abc-b730-6b65cb3de23e	86345ea6-8cec-4e7a-8b4b-8b5b1d45ddbd	4efac273-318c-4742-b381-e07a7d4d63d0	ee6ad2c4-a96e-4ea9-afb5-bb039b1c2629	{"Age": 25.0, "City": "Ottawa", "Gender": "Female", "Churned": 0.0, "Country": "Canada", "Returns_Rate": 7.0, "Credit_Balance": 1048.0, "Lifetime_Value": 503.26, "Signup_Quarter": "Q3", "Wishlist_Items": 1.0, "Email_Open_Rate": 0.0, "Login_Frequency": 4.0, "Membership_Years": 0.9, "Mobile_App_Usage": 15.5, "Pages_Per_Session": 3.7, "Average_Order_Value": 116.39, "Discount_Usage_Rate": 42.6, "Session_Duration_Avg": 12.4, "Cart_Abandonment_Rate": 68.5, "Customer_Service_Calls": 9.0, "Product_Reviews_Written": 1.0, "Days_Since_Last_Purchase": 78.0, "Payment_Method_Diversity": 1.0, "Social_Media_Engagement_Score": 0.0}	0	Low	0.9999483823776245	5.146620242157951e-05	2.05936942165863e-07	2026-11-05 13:38:02.871688+07
5a04cc42-b1be-4dc8-bb39-63ad85c1d615	5186dd01-8b18-4abc-b730-6b65cb3de23e	86345ea6-8cec-4e7a-8b4b-8b5b1d45ddbd	e7cab491-86a0-487f-b40e-5e5b6d6b2c5d	efdea114-ea80-4b5c-94d2-0590544d3ea0	{"Age": 31.0, "City": "New York", "Gender": "Female", "Churned": 0.0, "Country": "USA", "Returns_Rate": 2.5, "Credit_Balance": 2564.0, "Lifetime_Value": 1692.54, "Signup_Quarter": "Q3", "Wishlist_Items": 5.0, "Email_Open_Rate": 45.0, "Login_Frequency": 24.0, "Membership_Years": 1.4, "Mobile_App_Usage": 26.5, "Pages_Per_Session": 18.0, "Average_Order_Value": 91.92, "Discount_Usage_Rate": 83.8, "Session_Duration_Avg": 50.8, "Cart_Abandonment_Rate": 44.0, "Customer_Service_Calls": 4.0, "Product_Reviews_Written": 5.0, "Days_Since_Last_Purchase": 55.0, "Payment_Method_Diversity": 1.0, "Social_Media_Engagement_Score": 81.6}	2	High	2.1060920971649466e-06	0.003113087732344866	0.9968847632408142	2026-11-05 13:38:02.871688+07
0960597a-64f8-4b6b-b28c-eb6dc5b12e9e	5186dd01-8b18-4abc-b730-6b65cb3de23e	86345ea6-8cec-4e7a-8b4b-8b5b1d45ddbd	5296c492-d639-49b2-b079-ffd975e6fede	fcbf66a3-0563-4767-a279-3b75f0ae4a3e	{"Age": 56.0, "City": "Berlin", "Gender": "Male", "Churned": 0.0, "Country": "Germany", "Returns_Rate": 5.5, "Credit_Balance": 2657.0, "Lifetime_Value": 3003.57, "Signup_Quarter": "Q1", "Wishlist_Items": 5.0, "Email_Open_Rate": 35.5, "Login_Frequency": 24.0, "Membership_Years": 1.9, "Mobile_App_Usage": 42.9, "Pages_Per_Session": 13.9, "Average_Order_Value": 169.58, "Discount_Usage_Rate": 27.8, "Session_Duration_Avg": 46.4, "Cart_Abandonment_Rate": 36.2, "Customer_Service_Calls": 4.0, "Product_Reviews_Written": 6.0, "Days_Since_Last_Purchase": 10.0, "Payment_Method_Diversity": 5.0, "Social_Media_Engagement_Score": 68.8}	2	High	1.659083500271663e-05	0.008950060233473778	0.9910333752632141	2026-11-05 13:38:02.871688+07
5449871f-b5c1-4e28-b17f-cf85d4e4f528	19074c70-b960-466f-8a2a-61350a1f7065	86345ea6-8cec-4e7a-8b4b-8b5b1d45ddbd	0a9ab69a-3e34-41bd-91bd-2ff1a9611e13	32464d68-d517-4fda-9cdb-e04204f8efe9	{"Age": 34.0, "City": "Yokohama", "Gender": "Male", "Churned": 0.0, "Country": "Japan", "Returns_Rate": 5.9, "Credit_Balance": 1889.0, "Lifetime_Value": 1226.33, "Signup_Quarter": "Q3", "Wishlist_Items": 8.0, "Email_Open_Rate": 23.8, "Login_Frequency": 12.0, "Membership_Years": 4.4, "Mobile_App_Usage": 28.8, "Pages_Per_Session": 13.3, "Average_Order_Value": 65.22, "Discount_Usage_Rate": 32.3, "Session_Duration_Avg": 42.1, "Cart_Abandonment_Rate": 38.3, "Customer_Service_Calls": 1.0, "Product_Reviews_Written": 2.0, "Days_Since_Last_Purchase": 10.0, "Payment_Method_Diversity": 2.0, "Social_Media_Engagement_Score": 38.8}	2	High	2.6006788175436668e-05	0.10730288177728653	0.8926711082458496	2026-11-16 19:40:00.05625+07
dc08e570-44d7-4373-843b-0cd690c80bef	19074c70-b960-466f-8a2a-61350a1f7065	86345ea6-8cec-4e7a-8b4b-8b5b1d45ddbd	727ec9c1-79ad-4c07-acfe-8daf9690fb2c	3ea17821-fe0c-467b-8ee4-d8a1716c8db4	{"Age": 56.0, "City": "New York", "Gender": "Female", "Churned": 0.0, "Country": "USA", "Returns_Rate": 5.4, "Credit_Balance": 2674.0, "Lifetime_Value": 2340.92, "Signup_Quarter": "Q1", "Wishlist_Items": 9.0, "Email_Open_Rate": 41.4, "Login_Frequency": 10.0, "Membership_Years": 2.6, "Mobile_App_Usage": 31.0, "Pages_Per_Session": 14.8, "Average_Order_Value": 147.33, "Discount_Usage_Rate": 44.1, "Session_Duration_Avg": 38.4, "Cart_Abandonment_Rate": 41.7, "Customer_Service_Calls": 2.0, "Product_Reviews_Written": 5.0, "Days_Since_Last_Purchase": 47.0, "Payment_Method_Diversity": 3.0, "Social_Media_Engagement_Score": 85.9}	2	High	0.00010283983283443376	0.11101213097572327	0.8888850212097168	2026-11-16 19:40:00.05625+07
37c813a7-0985-4bc2-887f-7383fd844347	19074c70-b960-466f-8a2a-61350a1f7065	86345ea6-8cec-4e7a-8b4b-8b5b1d45ddbd	31c63922-7346-414c-8346-deae09984763	71a3fc19-abba-49d9-a693-c3acaed40168	{"Age": 42.0, "City": "Chicago", "Gender": "Male", "Churned": 0.0, "Country": "USA", "Returns_Rate": 7.0, "Credit_Balance": 2656.0, "Lifetime_Value": 1345.57, "Signup_Quarter": "Q2", "Wishlist_Items": 4.0, "Email_Open_Rate": 23.3, "Login_Frequency": 7.0, "Membership_Years": 3.4, "Mobile_App_Usage": 18.9, "Pages_Per_Session": 12.2, "Average_Order_Value": 150.38, "Discount_Usage_Rate": 71.3, "Session_Duration_Avg": 25.9, "Cart_Abandonment_Rate": 62.5, "Customer_Service_Calls": 2.0, "Product_Reviews_Written": 2.0, "Days_Since_Last_Purchase": 24.0, "Payment_Method_Diversity": 2.0, "Social_Media_Engagement_Score": 4.7}	0	Low	0.7807707786560059	0.21857337653636932	0.0006558306631632149	2026-11-16 19:40:00.05625+07
92efd31c-19cd-4464-9c3a-e933a471e23a	19074c70-b960-466f-8a2a-61350a1f7065	86345ea6-8cec-4e7a-8b4b-8b5b1d45ddbd	ca7c6bc9-5e44-424f-8fe2-75c5b00201a0	a06ed6d7-559b-4f15-ba70-719f1a96648d	{"Age": 55.0, "City": "Bangalore", "Gender": "Female", "Churned": 0.0, "Country": "India", "Returns_Rate": 11.6, "Credit_Balance": 4561.0, "Lifetime_Value": 3063.29, "Signup_Quarter": "Q1", "Wishlist_Items": 9.0, "Email_Open_Rate": 72.1, "Login_Frequency": 24.0, "Membership_Years": 1.2, "Mobile_App_Usage": 37.8, "Pages_Per_Session": 16.0, "Average_Order_Value": 108.52, "Discount_Usage_Rate": 33.0, "Session_Duration_Avg": 50.3, "Cart_Abandonment_Rate": 25.2, "Customer_Service_Calls": 1.0, "Product_Reviews_Written": 5.0, "Days_Since_Last_Purchase": 4.0, "Payment_Method_Diversity": 1.0, "Social_Media_Engagement_Score": 76.7}	2	High	5.26578114445897e-09	5.645930286846124e-06	0.9999943971633911	2026-11-16 19:40:00.05625+07
cbc11b9e-c021-420f-85d8-b8eeb29efcd5	78df85d9-e679-439c-b3f1-14568ca7d960	86345ea6-8cec-4e7a-8b4b-8b5b1d45ddbd	512e5df4-5b71-4063-86b2-bf4383fa076c	00df99b7-d3c2-448e-a3cf-136f052188e1	{"Age": 42.0, "City": "Phoenix", "Gender": "Male", "Churned": 0.0, "Country": "USA", "Returns_Rate": 1.1, "Credit_Balance": 1549.0, "Lifetime_Value": 1022.78, "Signup_Quarter": "Q4", "Wishlist_Items": 1.0, "Email_Open_Rate": 3.6, "Login_Frequency": 3.0, "Membership_Years": 4.7, "Mobile_App_Usage": 16.9, "Pages_Per_Session": 7.4, "Average_Order_Value": 178.42, "Discount_Usage_Rate": 20.279999999999998, "Session_Duration_Avg": 17.7, "Cart_Abandonment_Rate": 59.2, "Customer_Service_Calls": 10.0, "Product_Reviews_Written": 3.0, "Days_Since_Last_Purchase": 5.0, "Payment_Method_Diversity": 2.0, "Social_Media_Engagement_Score": 8.5}	0	Low	0.8956965804100037	0.104107566177845	0.0001958427019417286	2026-11-19 19:32:49.287873+07
874b9530-5d41-44a6-b8e1-0c0fc1cc3f84	78df85d9-e679-439c-b3f1-14568ca7d960	86345ea6-8cec-4e7a-8b4b-8b5b1d45ddbd	f770ce3f-2c85-41d6-b30e-55e2cde77409	01dba1fc-b97c-4186-be58-cd7777eb89a5	{"Age": 47.0, "City": "Glasgow", "Gender": "Female", "Churned": 0.0, "Country": "UK", "Returns_Rate": 2.7, "Credit_Balance": 3482.0, "Lifetime_Value": 725.92, "Signup_Quarter": "Q3", "Wishlist_Items": 5.0, "Email_Open_Rate": 12.8, "Login_Frequency": 9.0, "Membership_Years": 2.1, "Mobile_App_Usage": 15.5, "Pages_Per_Session": 5.1, "Average_Order_Value": 121.45, "Discount_Usage_Rate": 21.6, "Session_Duration_Avg": 16.3, "Cart_Abandonment_Rate": 62.3, "Customer_Service_Calls": 8.0, "Product_Reviews_Written": 2.0, "Days_Since_Last_Purchase": 1.0, "Payment_Method_Diversity": 1.0, "Social_Media_Engagement_Score": 10.0}	0	Low	0.9988173842430115	0.0011820477666333318	5.305436729940993e-07	2026-11-19 19:32:49.287873+07
abba76a9-7809-42a5-a223-8e3963b1bc6e	78df85d9-e679-439c-b3f1-14568ca7d960	86345ea6-8cec-4e7a-8b4b-8b5b1d45ddbd	7c99aa26-bd79-4af6-b3a6-c12d584a74a3	1aa63836-efcd-4e55-80f3-55e1371df090	{"Age": 43.0, "City": "Adelaide", "Gender": "Male", "Churned": 0.0, "Country": "Australia", "Returns_Rate": 6.7, "Credit_Balance": 1549.0, "Lifetime_Value": 824.37, "Signup_Quarter": "Q3", "Wishlist_Items": 4.0, "Email_Open_Rate": 6.3, "Login_Frequency": 13.0, "Membership_Years": 3.4, "Mobile_App_Usage": 19.4, "Pages_Per_Session": 11.2, "Average_Order_Value": 96.62, "Discount_Usage_Rate": 30.3, "Session_Duration_Avg": 26.6, "Cart_Abandonment_Rate": 63.1, "Customer_Service_Calls": 5.0, "Product_Reviews_Written": 3.0, "Days_Since_Last_Purchase": 65.0, "Payment_Method_Diversity": 2.0, "Social_Media_Engagement_Score": 29.4}	0	Low	0.8657049536705017	0.13397294282913208	0.0003221594961360097	2026-11-19 19:32:49.287873+07
9ead2865-d490-4fe4-8f00-07c6373618bd	78df85d9-e679-439c-b3f1-14568ca7d960	86345ea6-8cec-4e7a-8b4b-8b5b1d45ddbd	60ecc394-6aa6-491e-a094-cbb3dc6a48e9	85d60df5-5232-449c-ad18-0f0fb46bf583	{"Age": 40.0, "City": "Phoenix", "Gender": "Male", "Churned": 0.0, "Country": "USA", "Returns_Rate": 7.9, "Credit_Balance": 2966.0, "Lifetime_Value": 1506.54, "Signup_Quarter": "Q3", "Wishlist_Items": 1.0, "Email_Open_Rate": 0.0, "Login_Frequency": 18.0, "Membership_Years": 3.2, "Mobile_App_Usage": 7.5, "Pages_Per_Session": 9.9, "Average_Order_Value": 145.04, "Discount_Usage_Rate": 62.0, "Session_Duration_Avg": 27.0, "Cart_Abandonment_Rate": 51.5, "Customer_Service_Calls": 1.0, "Product_Reviews_Written": 1.0, "Days_Since_Last_Purchase": 68.0, "Payment_Method_Diversity": 2.0, "Social_Media_Engagement_Score": 27.2}	1	Medium	0.4792371094226837	0.5151968002319336	0.005566101521253586	2026-11-19 19:32:49.287873+07
9c4358d2-1005-4826-85ee-7818001a2233	78df85d9-e679-439c-b3f1-14568ca7d960	86345ea6-8cec-4e7a-8b4b-8b5b1d45ddbd	45a52008-364c-4668-b267-e9a1e68cb835	cdc5c880-352e-40d1-8c7d-a993b2b39df5	{"Age": 51.0, "City": "Hamburg", "Gender": "Female", "Churned": 0.0, "Country": "Germany", "Returns_Rate": 3.1, "Credit_Balance": 1607.0, "Lifetime_Value": 1651.78, "Signup_Quarter": "Q1", "Wishlist_Items": 5.0, "Email_Open_Rate": 37.8, "Login_Frequency": 8.0, "Membership_Years": 1.7, "Mobile_App_Usage": 11.5, "Pages_Per_Session": 6.5, "Average_Order_Value": 125.34, "Discount_Usage_Rate": 55.7, "Session_Duration_Avg": 24.0, "Cart_Abandonment_Rate": 51.5, "Customer_Service_Calls": 3.0, "Product_Reviews_Written": 1.0, "Days_Since_Last_Purchase": 34.0, "Payment_Method_Diversity": 2.0, "Social_Media_Engagement_Score": 69.0}	1	Medium	0.01997179538011551	0.9176425933837891	0.06238556280732155	2026-11-19 19:32:49.287873+07
9d9ff4c9-5ad1-44b8-8292-f8cc6bed0d5e	78df85d9-e679-439c-b3f1-14568ca7d960	86345ea6-8cec-4e7a-8b4b-8b5b1d45ddbd	35a65074-15a4-471a-b62d-560656bb7cc0	e6c8f581-ea52-4197-b14d-bde1a5f4cec9	{"Age": 36.0, "City": "Chicago", "Gender": "Male", "Churned": 0.0, "Country": "USA", "Returns_Rate": 2.1, "Credit_Balance": 1416.0, "Lifetime_Value": 1133.62, "Signup_Quarter": "Q2", "Wishlist_Items": 4.0, "Email_Open_Rate": 11.6, "Login_Frequency": 0.0, "Membership_Years": 1.4, "Mobile_App_Usage": 19.9, "Pages_Per_Session": 5.1, "Average_Order_Value": 199.48, "Discount_Usage_Rate": 47.8, "Session_Duration_Avg": 33.0, "Cart_Abandonment_Rate": 75.1, "Customer_Service_Calls": 6.0, "Product_Reviews_Written": 1.0, "Days_Since_Last_Purchase": 43.0, "Payment_Method_Diversity": 3.0, "Social_Media_Engagement_Score": 23.9}	0	Low	0.9976297616958618	0.0023694324772804976	8.253439318650635e-07	2026-11-19 19:32:49.287873+07
8bcfc2a0-ba65-4345-a5bd-39059ed3f7fa	78df85d9-e679-439c-b3f1-14568ca7d960	86345ea6-8cec-4e7a-8b4b-8b5b1d45ddbd	dbd047a8-f3e5-475c-8acd-b009407de2e1	f137ef20-f5f3-4ab3-adaa-a3b95bde5caa	{"Age": 41.0, "City": "Chicago", "Gender": "Male", "Churned": 0.0, "Country": "USA", "Returns_Rate": 17.0, "Credit_Balance": 2442.0, "Lifetime_Value": 1862.75, "Signup_Quarter": "Q3", "Wishlist_Items": 5.0, "Email_Open_Rate": 39.2, "Login_Frequency": 23.0, "Membership_Years": 3.4, "Mobile_App_Usage": 27.8, "Pages_Per_Session": 14.2, "Average_Order_Value": 111.93, "Discount_Usage_Rate": 25.1, "Session_Duration_Avg": 44.6, "Cart_Abandonment_Rate": 46.8, "Customer_Service_Calls": 4.0, "Product_Reviews_Written": 1.0, "Days_Since_Last_Purchase": 48.0, "Payment_Method_Diversity": 1.0, "Social_Media_Engagement_Score": 35.2}	2	High	6.820998532930389e-05	0.11930238455533981	0.8806294202804565	2026-11-19 19:32:49.287873+07
75be29ab-c5a7-4cc1-acec-223deec3ab83	78df85d9-e679-439c-b3f1-14568ca7d960	86345ea6-8cec-4e7a-8b4b-8b5b1d45ddbd	946fe89f-61ca-41a3-b193-878471e439c2	fdf9215b-960a-44d3-98f9-6683a2c590f7	{"Age": 37.0, "City": "Munich", "Gender": "Male", "Churned": 1.0, "Country": "Germany", "Returns_Rate": 5.1, "Credit_Balance": 2544.0, "Lifetime_Value": 3367.15, "Signup_Quarter": "Q3", "Wishlist_Items": 14.0, "Email_Open_Rate": 33.6, "Login_Frequency": 29.0, "Membership_Years": 7.5, "Mobile_App_Usage": 39.6, "Pages_Per_Session": 15.9, "Average_Order_Value": 134.1, "Discount_Usage_Rate": 22.2, "Session_Duration_Avg": 48.9, "Cart_Abandonment_Rate": 27.8, "Customer_Service_Calls": 1.0, "Product_Reviews_Written": 10.0, "Days_Since_Last_Purchase": 34.0, "Payment_Method_Diversity": 5.0, "Social_Media_Engagement_Score": 59.0}	2	High	1.6487716436586197e-07	3.6291854485170916e-05	0.9999635219573975	2026-11-19 19:32:49.287873+07
fff68db8-8e04-46c4-802a-c0ab37545b7e	61192935-b76d-4da4-b033-56ed243cf44f	86345ea6-8cec-4e7a-8b4b-8b5b1d45ddbd	45a52008-364c-4668-b267-e9a1e68cb835	cdc5c880-352e-40d1-8c7d-a993b2b39df5	{"Age": 51.0, "City": "Hamburg", "Gender": "Female", "Churned": 0.0, "Country": "Germany", "Returns_Rate": 3.1, "Credit_Balance": 1607.0, "Lifetime_Value": 1651.78, "Signup_Quarter": "Q1", "Wishlist_Items": 5.0, "Email_Open_Rate": 37.8, "Login_Frequency": 8.0, "Membership_Years": 1.7, "Mobile_App_Usage": 11.5, "Pages_Per_Session": 6.5, "Average_Order_Value": 125.34, "Discount_Usage_Rate": 55.7, "Session_Duration_Avg": 24.0, "Cart_Abandonment_Rate": 51.5, "Customer_Service_Calls": 3.0, "Product_Reviews_Written": 1.0, "Days_Since_Last_Purchase": 34.0, "Payment_Method_Diversity": 2.0, "Social_Media_Engagement_Score": 69.0}	1	Medium	0.01997179538011551	0.9176425933837891	0.06238556280732155	2026-11-20 18:08:31.06794+07
796782a5-0f9d-4f67-a55e-0586c3d756a1	b498923b-c7d3-41a1-b3e5-2a1fe0630ae9	86345ea6-8cec-4e7a-8b4b-8b5b1d45ddbd	508fb791-a1f7-4b16-b012-3d62d176bde6	1348daf1-bd90-452d-a65e-97184357ea76	{"Age": 56.0, "City": "New York", "Gender": "Female", "Churned": 0.0, "Country": "USA", "Returns_Rate": 5.4, "Credit_Balance": 2674.0, "Lifetime_Value": 2340.92, "Signup_Quarter": "Q1", "Wishlist_Items": 9.0, "Email_Open_Rate": 41.4, "Login_Frequency": 10.0, "Membership_Years": 2.6, "Mobile_App_Usage": 31.0, "Pages_Per_Session": 14.8, "Average_Order_Value": 147.33, "Discount_Usage_Rate": 44.1, "Session_Duration_Avg": 38.4, "Cart_Abandonment_Rate": 41.7, "Customer_Service_Calls": 2.0, "Product_Reviews_Written": 5.0, "Days_Since_Last_Purchase": 47.0, "Payment_Method_Diversity": 3.0, "Social_Media_Engagement_Score": 85.9}	2	High	0.00010283983283443376	0.11101213097572327	0.8888850212097168	2026-11-24 20:08:08.165012+07
547f5518-1ace-4e99-bc3c-685ec7e620d5	b498923b-c7d3-41a1-b3e5-2a1fe0630ae9	86345ea6-8cec-4e7a-8b4b-8b5b1d45ddbd	4ccfd8f9-e500-4706-973a-3bbd09e63e74	5468500a-0345-4c3e-947f-117d267b4496	{"Age": 34.0, "City": "Yokohama", "Gender": "Male", "Churned": 0.0, "Country": "Japan", "Returns_Rate": 5.9, "Credit_Balance": 1889.0, "Lifetime_Value": 1226.33, "Signup_Quarter": "Q3", "Wishlist_Items": 8.0, "Email_Open_Rate": 23.8, "Login_Frequency": 12.0, "Membership_Years": 4.4, "Mobile_App_Usage": 28.8, "Pages_Per_Session": 13.3, "Average_Order_Value": 65.22, "Discount_Usage_Rate": 32.3, "Session_Duration_Avg": 42.1, "Cart_Abandonment_Rate": 38.3, "Customer_Service_Calls": 1.0, "Product_Reviews_Written": 2.0, "Days_Since_Last_Purchase": 10.0, "Payment_Method_Diversity": 2.0, "Social_Media_Engagement_Score": 38.8}	2	High	2.6006788175436668e-05	0.10730288177728653	0.8926711082458496	2026-11-24 20:08:08.165012+07
\.


--
-- Data for Name: prediction_runs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.prediction_runs (id, model_id, task, run_type, source, status, requested_count, success_count, failure_count, persist_results, error_message, created_at, completed_at) FROM stdin;
897f76a7-37f0-4d5e-b474-efe61dfecbf1	86345ea6-8cec-4e7a-8b4b-8b5b1d45ddbd	classification	single	api	completed	1	1	0	t	\N	2026-10-14 21:44:26.970871+07	2026-10-14 21:44:26.970871+07
bbb85172-13ae-4c6b-b337-4f13ed411b02	8b0b7247-65bc-4660-9b61-2ed6298820f6	segmentation	single	api	completed	1	1	0	t	\N	2026-10-14 21:46:15.999375+07	2026-10-14 21:46:15.999375+07
d7f0a944-6a63-45e6-b6d9-15bab25026cc	86345ea6-8cec-4e7a-8b4b-8b5b1d45ddbd	classification	single	api	completed	1	1	0	t	\N	2026-10-15 18:52:53.146433+07	2026-10-15 18:52:53.146433+07
1d284fed-44db-45a9-a250-7c816fa40ffd	8b0b7247-65bc-4660-9b61-2ed6298820f6	segmentation	single	api	completed	1	1	0	t	\N	2026-10-15 18:53:55.796238+07	2026-10-15 18:53:55.796238+07
c1549e15-6dd3-453c-b33b-93b0790ce994	86345ea6-8cec-4e7a-8b4b-8b5b1d45ddbd	classification	single	api	completed	1	1	0	t	\N	2026-10-15 19:14:04.343712+07	2026-10-15 19:14:04.343712+07
ebfec002-9aa5-48b7-a194-c3f78361e55d	8b0b7247-65bc-4660-9b61-2ed6298820f6	segmentation	single	api	completed	1	1	0	t	\N	2026-10-15 19:14:40.546512+07	2026-10-15 19:14:40.546512+07
7f64f5a1-2b03-4d7c-af3f-a4990a08f6d1	86345ea6-8cec-4e7a-8b4b-8b5b1d45ddbd	classification	single	api	completed	1	1	0	t	\N	2026-10-27 20:22:15.759199+07	2026-10-27 20:22:15.759199+07
66f35d16-eb81-40a5-9a82-e6683b80118e	86345ea6-8cec-4e7a-8b4b-8b5b1d45ddbd	classification	single	api	completed	1	1	0	t	\N	2026-10-27 20:31:09.965445+07	2026-10-27 20:31:09.965445+07
1132b2f2-060b-465d-a43d-fdd2f975a7ac	8b0b7247-65bc-4660-9b61-2ed6298820f6	segmentation	single	api	completed	1	1	0	t	\N	2026-10-27 20:31:51.870065+07	2026-10-27 20:31:51.870065+07
06067ad7-36d5-4a34-82a6-4623cd5638b4	8b0b7247-65bc-4660-9b61-2ed6298820f6	segmentation	single	api	completed	1	1	0	t	\N	2026-11-04 18:57:54.248003+07	2026-11-04 18:57:54.248003+07
abe5a49c-9215-4ba1-a73c-5bfcc5ebd797	8b0b7247-65bc-4660-9b61-2ed6298820f6	segmentation	single	api	completed	1	1	0	t	\N	2026-11-05 09:44:46.49192+07	2026-11-05 09:44:46.49192+07
97a4efa8-95d2-4090-b112-6a3233efb749	8b0b7247-65bc-4660-9b61-2ed6298820f6	segmentation	single	api	completed	1	1	0	t	\N	2026-11-05 09:47:40.530578+07	2026-11-05 09:47:40.530578+07
5186dd01-8b18-4abc-b730-6b65cb3de23e	86345ea6-8cec-4e7a-8b4b-8b5b1d45ddbd	classification	batch	f10:8d472a98-de02-4787-8031-307dfcf2c5f7	completed	10	10	0	t	\N	2026-11-05 13:38:02.871688+07	2026-11-05 13:38:02.871688+07
1eef9113-8c50-4d44-aeed-d48e68653461	8b0b7247-65bc-4660-9b61-2ed6298820f6	segmentation	batch	f10:51b206a9-f0b7-44d5-af62-5352ed488f79	completed	10	10	0	t	\N	2026-11-05 13:38:03.125569+07	2026-11-05 13:38:03.125569+07
19074c70-b960-466f-8a2a-61350a1f7065	86345ea6-8cec-4e7a-8b4b-8b5b1d45ddbd	classification	batch	f10:bca817b2-db34-41bb-adaa-237e58cebd28	completed	4	4	0	t	\N	2026-11-16 19:40:00.05625+07	2026-11-16 19:40:00.05625+07
6791ccba-4746-4c50-ad50-3319d3720efc	8b0b7247-65bc-4660-9b61-2ed6298820f6	segmentation	batch	f10:527831fc-e34c-4096-80b8-e8a0fc42d5b6	completed	4	4	0	t	\N	2026-11-16 19:40:00.225992+07	2026-11-16 19:40:00.225992+07
78df85d9-e679-439c-b3f1-14568ca7d960	86345ea6-8cec-4e7a-8b4b-8b5b1d45ddbd	classification	batch	f10:625e19c8-05aa-47b7-9468-d9d559efabd1	completed	8	8	0	t	\N	2026-11-19 19:32:49.287873+07	2026-11-19 19:32:49.287873+07
a28ed553-cb21-40d5-a450-f3c6c339463a	8b0b7247-65bc-4660-9b61-2ed6298820f6	segmentation	batch	f10:ea5c8fbf-3461-4687-af87-9d33d5a1a18b	completed	8	8	0	t	\N	2026-11-19 19:32:49.776339+07	2026-11-19 19:32:49.776339+07
61192935-b76d-4da4-b033-56ed243cf44f	86345ea6-8cec-4e7a-8b4b-8b5b1d45ddbd	classification	single	api	completed	1	1	0	t	\N	2026-11-20 18:08:31.06794+07	2026-11-20 18:08:31.06794+07
5212432c-e88f-43ca-9b7c-034323b89095	8b0b7247-65bc-4660-9b61-2ed6298820f6	segmentation	single	api	completed	1	1	0	t	\N	2026-11-20 18:09:43.851675+07	2026-11-20 18:09:43.851675+07
b498923b-c7d3-41a1-b3e5-2a1fe0630ae9	86345ea6-8cec-4e7a-8b4b-8b5b1d45ddbd	classification	batch	f10:4662e586-3035-4d57-aa34-a349862b0987	completed	2	2	0	t	\N	2026-11-24 20:08:08.165012+07	2026-11-24 20:08:08.165012+07
ed9f9b2f-36f9-430c-83e1-fa86bcec873e	8b0b7247-65bc-4660-9b61-2ed6298820f6	segmentation	batch	f10:bfece1c3-2e7e-41cf-a591-32afc17a5f9f	completed	2	2	0	t	\N	2026-11-24 20:08:08.510814+07	2026-11-24 20:08:08.510814+07
\.


--
-- Data for Name: prediction_scenarios; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.prediction_scenarios (id, customer_id, baseline_snapshot_id, name, description, changed_features, created_at) FROM stdin;
de8f966f-1cca-4615-9717-710fc1e94662	727ec9c1-79ad-4c07-acfe-8daf9690fb2c	3ea17821-fe0c-467b-8ee4-d8a1716c8db4	demo	123	{"audit": {"scope": "snapshot_input_sensitivity_not_causal_or_future", "baseline_warnings": ["AVAILABILITY_UNKNOWN", "LEGACY_PROXY_FEATURES_UNVERIFIED", "NON_CAUSAL", "PLAUSIBILITY_NOT_VERIFIED", "SNAPSHOT_ONLY", "SUPPORT_RANGE_UNKNOWN"], "comparison_warnings": ["AVAILABILITY_UNKNOWN", "LEGACY_PROXY_FEATURES_UNVERIFIED", "NON_CAUSAL", "PLAUSIBILITY_NOT_VERIFIED", "SNAPSHOT_ONLY", "SUPPORT_RANGE_UNKNOWN"], "baseline_generated_at": "2026-11-19T13:07:12.604465Z"}, "models": {"segmentation": null, "classification": {"model_id": "purchase-level-xgboost", "model_version": "1.0.0", "artifact_sha256": "1bbde6767f3b14bc5d29da3c848e53256363638f34e3263be0238e950e527e8f", "metadata_sha256": "f1e3b720cac81c5e078dbf45443c599c999c969d749cbbe11545bed3a78a0a65", "validation_policy": "what-if-snapshot-v1"}}, "source": {"kind": "customer", "original_customer_id": "727ec9c1-79ad-4c07-acfe-8daf9690fb2c", "original_snapshot_id": "3ea17821-fe0c-467b-8ee4-d8a1716c8db4"}, "changes": [{"after": 5.0, "before": 10.0, "feature": "Login_Frequency"}, {"after": 12.0, "before": 14.8, "feature": "Pages_Per_Session"}, {"after": 30.0, "before": 41.4, "feature": "Email_Open_Rate"}, {"after": 25.0, "before": 31.0, "feature": "Mobile_App_Usage"}], "idempotency": {"key": "e1e63464-55c9-4b4b-8887-00dcb015d130", "scope": "local-demo-single-owner-v1", "canonical_intent_sha256": "df0462f565a607d9c244d8bb95b38ff41ed8924db88146a478985094434f9d2b"}, "interpretation": "snapshot_non_causal", "schema_version": "what-if-snapshot-v1", "acknowledgement": {"sensitive_snapshot_storage": true}, "canonicalization": "what-if-canonical-json-v1", "requested_changes": {"Email_Open_Rate": 30.0, "Login_Frequency": 5.0, "Mobile_App_Usage": 25.0, "Pages_Per_Session": 12.0}, "baseline_fingerprint": "6e3dacba60f1ee59399e0c35a7751bb24bf64772e5e59bbe5e7c3dbd268f2395", "comparison_fingerprint": "9039751ffb5abf412c51c20000e51ca32a2105b4f511ba840e8668e6198616bf"}	2026-11-19 20:07:12.549359+07
a1e14eb7-ef03-4945-ae96-a45565999025	35a65074-15a4-471a-b62d-560656bb7cc0	e6c8f581-ea52-4197-b14d-bde1a5f4cec9	demo	123	{"audit": {"scope": "snapshot_input_sensitivity_not_causal_or_future", "baseline_warnings": ["AVAILABILITY_UNKNOWN", "LEGACY_PROXY_FEATURES_UNVERIFIED", "NON_CAUSAL", "PLAUSIBILITY_NOT_VERIFIED", "SNAPSHOT_ONLY", "SUPPORT_RANGE_UNKNOWN"], "comparison_warnings": ["AVAILABILITY_UNKNOWN", "LEGACY_PROXY_FEATURES_UNVERIFIED", "NON_CAUSAL", "PLAUSIBILITY_NOT_VERIFIED", "SNAPSHOT_ONLY", "SUPPORT_RANGE_UNKNOWN"], "baseline_generated_at": "2026-11-20T11:11:09.658338Z"}, "models": {"segmentation": null, "classification": {"model_id": "purchase-level-xgboost", "model_version": "1.0.0", "artifact_sha256": "1bbde6767f3b14bc5d29da3c848e53256363638f34e3263be0238e950e527e8f", "metadata_sha256": "f1e3b720cac81c5e078dbf45443c599c999c969d749cbbe11545bed3a78a0a65", "validation_policy": "what-if-snapshot-v1"}}, "source": {"kind": "customer", "original_customer_id": "35a65074-15a4-471a-b62d-560656bb7cc0", "original_snapshot_id": "e6c8f581-ea52-4197-b14d-bde1a5f4cec9"}, "changes": [{"after": 26.0, "before": 5.1, "feature": "Pages_Per_Session"}, {"after": 10.0, "before": 4.0, "feature": "Wishlist_Items"}, {"after": 20.0, "before": 11.6, "feature": "Email_Open_Rate"}, {"after": 32.0, "before": 19.9, "feature": "Mobile_App_Usage"}], "idempotency": {"key": "e72d01d2-9099-4314-897d-8ce8d1f68e65", "scope": "local-demo-single-owner-v1", "canonical_intent_sha256": "348fa4c76e3d12832ef97b4314ada0c84e11a949f5654aa1fa26eefc1052af41"}, "interpretation": "snapshot_non_causal", "schema_version": "what-if-snapshot-v1", "acknowledgement": {"sensitive_snapshot_storage": true}, "canonicalization": "what-if-canonical-json-v1", "requested_changes": {"Wishlist_Items": 10.0, "Email_Open_Rate": 20.0, "Mobile_App_Usage": 32.0, "Pages_Per_Session": 26.0}, "baseline_fingerprint": "fb43b10f35c5910f0d27a66b98de58d447426daf50519de2b70bcd917e0160a7", "comparison_fingerprint": "940cc15f574b2a7f7852294aeee2ea793193f405ffba8febcd141ceddea605c4"}	2026-11-20 18:11:09.59328+07
\.


--
-- Data for Name: scenario_results; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.scenario_results (id, scenario_id, model_id, baseline_prediction_result_id, before_result, after_result, probability_deltas, created_at) FROM stdin;
0f82e7d1-aa2c-44a7-8ac9-37d11e24ba0a	de8f966f-1cca-4615-9717-710fc1e94662	86345ea6-8cec-4e7a-8b4b-8b5b1d45ddbd	\N	{"prediction": {"task": "classification", "model": {"model_id": "purchase-level-xgboost", "model_version": "1.0.0", "artifact_sha256": "1bbde6767f3b14bc5d29da3c848e53256363638f34e3263be0238e950e527e8f", "metadata_sha256": "f1e3b720cac81c5e078dbf45443c599c999c969d749cbbe11545bed3a78a0a65", "validation_policy": "what-if-snapshot-v1"}, "decision_rule": "argmax_probability", "probabilities": {"Low": 0.00010283983283443376, "High": 0.8888850212097168, "Medium": 0.11101213097572327}, "purchase_level": "High", "predicted_class": 2, "target_thresholds": {"low_inclusive": 10.0, "medium_inclusive": 15.0}}, "input_sha256": "dd1683a0b6f555a2e801b371fe4737eac071c05031da4491b4956594fa578978", "input_features": {"Age": 56.0, "City": "New York", "Gender": "Female", "Churned": 0.0, "Country": "USA", "Returns_Rate": 5.4, "Credit_Balance": 2674.0, "Lifetime_Value": 2340.92, "Signup_Quarter": "Q1", "Wishlist_Items": 9.0, "Email_Open_Rate": 41.4, "Login_Frequency": 10.0, "Membership_Years": 2.6, "Mobile_App_Usage": 31.0, "Pages_Per_Session": 14.8, "Average_Order_Value": 147.33, "Discount_Usage_Rate": 44.1, "Session_Duration_Avg": 38.4, "Cart_Abandonment_Rate": 41.7, "Customer_Service_Calls": 2.0, "Product_Reviews_Written": 5.0, "Days_Since_Last_Purchase": 47.0, "Payment_Method_Diversity": 3.0, "Social_Media_Engagement_Score": 85.9}, "interpretation": "snapshot_non_causal", "schema_version": "what-if-snapshot-v1"}	{"prediction": {"task": "classification", "model": {"model_id": "purchase-level-xgboost", "model_version": "1.0.0", "artifact_sha256": "1bbde6767f3b14bc5d29da3c848e53256363638f34e3263be0238e950e527e8f", "metadata_sha256": "f1e3b720cac81c5e078dbf45443c599c999c969d749cbbe11545bed3a78a0a65", "validation_policy": "what-if-snapshot-v1"}, "decision_rule": "argmax_probability", "probabilities": {"Low": 0.0003482361789792776, "High": 0.707147479057312, "Medium": 0.292504221200943}, "purchase_level": "High", "predicted_class": 2, "target_thresholds": {"low_inclusive": 10.0, "medium_inclusive": 15.0}}, "input_sha256": "f3f3d38af6ffbec30763bc31945e10c82126dfe394251b9e9e6a6fa62bf55365", "input_features": {"Age": 56.0, "City": "New York", "Gender": "Female", "Churned": 0.0, "Country": "USA", "Returns_Rate": 5.4, "Credit_Balance": 2674.0, "Lifetime_Value": 2340.92, "Signup_Quarter": "Q1", "Wishlist_Items": 9.0, "Email_Open_Rate": 30.0, "Login_Frequency": 5.0, "Membership_Years": 2.6, "Mobile_App_Usage": 25.0, "Pages_Per_Session": 12.0, "Average_Order_Value": 147.33, "Discount_Usage_Rate": 44.1, "Session_Duration_Avg": 38.4, "Cart_Abandonment_Rate": 41.7, "Customer_Service_Calls": 2.0, "Product_Reviews_Written": 5.0, "Days_Since_Last_Purchase": 47.0, "Payment_Method_Diversity": 3.0, "Social_Media_Engagement_Score": 85.9}, "interpretation": "snapshot_non_causal", "schema_version": "what-if-snapshot-v1"}	{"task": "classification", "absolute": {"Low": 0.00024539634614484385, "High": -0.18173754215240479, "Medium": 0.18149209022521973}, "relative": {"Low": 2.386199387740331, "High": -0.2044556245363111, "Medium": 1.6348852024551208}, "warnings": ["AVAILABILITY_UNKNOWN", "LEGACY_PROXY_FEATURES_UNVERIFIED", "NON_CAUSAL", "PLAUSIBILITY_NOT_VERIFIED", "SNAPSHOT_ONLY", "SUPPORT_RANGE_UNKNOWN"], "supported": true, "class_changed": false, "schema_version": "what-if-snapshot-v1", "percentage_points": {"Low": 0.024539634614484385, "High": -18.17375421524048, "Medium": 18.149209022521973}, "comparison_fingerprint": "9039751ffb5abf412c51c20000e51ca32a2105b4f511ba840e8668e6198616bf"}	2026-11-19 20:07:12.549359+07
5cf9bb2b-eb55-4673-85b0-865bfd728ecf	a1e14eb7-ef03-4945-ae96-a45565999025	86345ea6-8cec-4e7a-8b4b-8b5b1d45ddbd	\N	{"prediction": {"task": "classification", "model": {"model_id": "purchase-level-xgboost", "model_version": "1.0.0", "artifact_sha256": "1bbde6767f3b14bc5d29da3c848e53256363638f34e3263be0238e950e527e8f", "metadata_sha256": "f1e3b720cac81c5e078dbf45443c599c999c969d749cbbe11545bed3a78a0a65", "validation_policy": "what-if-snapshot-v1"}, "decision_rule": "argmax_probability", "probabilities": {"Low": 0.9976297616958618, "High": 0.0000008253439318650635, "Medium": 0.0023694324772804976}, "purchase_level": "Low", "predicted_class": 0, "target_thresholds": {"low_inclusive": 10.0, "medium_inclusive": 15.0}}, "input_sha256": "ddface7ee39d93e335d4604aa10eae6db11bf686a750545c1deb68402e90717e", "input_features": {"Age": 36.0, "City": "Chicago", "Gender": "Male", "Churned": 0.0, "Country": "USA", "Returns_Rate": 2.1, "Credit_Balance": 1416.0, "Lifetime_Value": 1133.62, "Signup_Quarter": "Q2", "Wishlist_Items": 4.0, "Email_Open_Rate": 11.6, "Login_Frequency": 0.0, "Membership_Years": 1.4, "Mobile_App_Usage": 19.9, "Pages_Per_Session": 5.1, "Average_Order_Value": 199.48, "Discount_Usage_Rate": 47.8, "Session_Duration_Avg": 33.0, "Cart_Abandonment_Rate": 75.1, "Customer_Service_Calls": 6.0, "Product_Reviews_Written": 1.0, "Days_Since_Last_Purchase": 43.0, "Payment_Method_Diversity": 3.0, "Social_Media_Engagement_Score": 23.9}, "interpretation": "snapshot_non_causal", "schema_version": "what-if-snapshot-v1"}	{"prediction": {"task": "classification", "model": {"model_id": "purchase-level-xgboost", "model_version": "1.0.0", "artifact_sha256": "1bbde6767f3b14bc5d29da3c848e53256363638f34e3263be0238e950e527e8f", "metadata_sha256": "f1e3b720cac81c5e078dbf45443c599c999c969d749cbbe11545bed3a78a0a65", "validation_policy": "what-if-snapshot-v1"}, "decision_rule": "argmax_probability", "probabilities": {"Low": 0.9869339466094971, "High": 0.00001661817623244133, "Medium": 0.013049380853772163}, "purchase_level": "Low", "predicted_class": 0, "target_thresholds": {"low_inclusive": 10.0, "medium_inclusive": 15.0}}, "input_sha256": "ceccacfbe3dd5309e98d9cbe58f127f486b611f4150c9ea8f7ea7f26ca4d720f", "input_features": {"Age": 36.0, "City": "Chicago", "Gender": "Male", "Churned": 0.0, "Country": "USA", "Returns_Rate": 2.1, "Credit_Balance": 1416.0, "Lifetime_Value": 1133.62, "Signup_Quarter": "Q2", "Wishlist_Items": 10.0, "Email_Open_Rate": 20.0, "Login_Frequency": 0.0, "Membership_Years": 1.4, "Mobile_App_Usage": 32.0, "Pages_Per_Session": 26.0, "Average_Order_Value": 199.48, "Discount_Usage_Rate": 47.8, "Session_Duration_Avg": 33.0, "Cart_Abandonment_Rate": 75.1, "Customer_Service_Calls": 6.0, "Product_Reviews_Written": 1.0, "Days_Since_Last_Purchase": 43.0, "Payment_Method_Diversity": 3.0, "Social_Media_Engagement_Score": 23.9}, "interpretation": "snapshot_non_causal", "schema_version": "what-if-snapshot-v1"}	{"task": "classification", "absolute": {"Low": -0.010695815086364746, "High": 0.000015792832300576265, "Medium": 0.010679948376491666}, "relative": {"Low": -0.010721226949146973, "High": 19.134849958717883, "Medium": 4.507386675458047}, "warnings": ["AVAILABILITY_UNKNOWN", "LEGACY_PROXY_FEATURES_UNVERIFIED", "NON_CAUSAL", "PLAUSIBILITY_NOT_VERIFIED", "SNAPSHOT_ONLY", "SUPPORT_RANGE_UNKNOWN"], "supported": true, "class_changed": false, "schema_version": "what-if-snapshot-v1", "percentage_points": {"Low": -1.0695815086364746, "High": 0.0015792832300576265, "Medium": 1.0679948376491666}, "comparison_fingerprint": "940cc15f574b2a7f7852294aeee2ea793193f405ffba8febcd141ceddea605c4"}	2026-11-20 18:11:09.59328+07
\.


--
-- Data for Name: segmentation_results; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.segmentation_results (id, run_id, model_id, customer_id, behavior_snapshot_id, input_features, cluster, segment_name, distance_to_centroid, created_at) FROM stdin;
a1b97b6c-06e5-4ecf-8ee4-060f813274be	bbb85172-13ae-4c6b-b337-4f13ed411b02	8b0b7247-65bc-4660-9b61-2ed6298820f6	011b60c4-a5a6-407c-af96-b443441fb6c7	938951c1-b93d-49bd-b2c9-184cc5ba896d	{"Wishlist_Items": 3, "Login_Frequency": 14, "Total_Purchases": 9, "Mobile_App_Usage": 20.8, "Pages_Per_Session": 6, "Average_Order_Value": 94.72, "Discount_Usage_Rate": 46.4, "Session_Duration_Avg": 27.4, "Cart_Abandonment_Rate": 50.6, "Days_Since_Last_Purchase": 34}	2	Khách hàng tiềm năng	1.525176066149531	2026-10-14 21:46:15.999375+07
d7a5780f-3dc7-4f2b-98d9-109862689c50	1d284fed-44db-45a9-a250-7c816fa40ffd	8b0b7247-65bc-4660-9b61-2ed6298820f6	53c9ba41-a255-4a48-a08a-993966fee1e6	6c834e26-1dd9-4f96-94fe-e5461edca810	{"Wishlist_Items": 3, "Login_Frequency": 14, "Total_Purchases": 9, "Mobile_App_Usage": 20.8, "Pages_Per_Session": 6, "Average_Order_Value": 94.72, "Discount_Usage_Rate": 46.4, "Session_Duration_Avg": 27.4, "Cart_Abandonment_Rate": 50.6, "Days_Since_Last_Purchase": 34}	2	Khách hàng tiềm năng	1.525176066149531	2026-10-15 18:53:55.796238+07
991441b3-14eb-442e-ab37-5ead1153039c	ebfec002-9aa5-48b7-a194-c3f78361e55d	8b0b7247-65bc-4660-9b61-2ed6298820f6	4f095c96-ef11-49cc-b387-ecb35bc77068	fca46dbd-af94-4a30-9bf1-eec296bd66f4	{"Wishlist_Items": 3, "Login_Frequency": 14, "Total_Purchases": 9, "Mobile_App_Usage": 20.8, "Pages_Per_Session": 6, "Average_Order_Value": 94.72, "Discount_Usage_Rate": 46.4, "Session_Duration_Avg": 27.4, "Cart_Abandonment_Rate": 50.6, "Days_Since_Last_Purchase": 34}	2	Khách hàng tiềm năng	1.525176066149531	2026-10-15 19:14:40.546512+07
009793a7-fbe7-4707-afa7-5c168a68aaea	1132b2f2-060b-465d-a43d-fdd2f975a7ac	8b0b7247-65bc-4660-9b61-2ed6298820f6	011b60c4-a5a6-407c-af96-b443441fb6c7	\N	{"Wishlist_Items": 6.0, "Login_Frequency": 14.0, "Total_Purchases": 9.0, "Mobile_App_Usage": 20.8, "Pages_Per_Session": 6.0, "Average_Order_Value": 94.72, "Discount_Usage_Rate": 55.0, "Session_Duration_Avg": 27.4, "Cart_Abandonment_Rate": 50.6, "Days_Since_Last_Purchase": 30.0}	2	Khách hàng tiềm năng	1.6106212452638187	2026-10-27 20:31:51.870065+07
0643cd82-b1dd-48b7-aa99-1fb5715c539a	06067ad7-36d5-4a34-82a6-4623cd5638b4	8b0b7247-65bc-4660-9b61-2ed6298820f6	011b60c4-a5a6-407c-af96-b443441fb6c7	938951c1-b93d-49bd-b2c9-184cc5ba896d	{"Wishlist_Items": 3.0, "Login_Frequency": 14.0, "Total_Purchases": 9.0, "Mobile_App_Usage": 20.8, "Pages_Per_Session": 6.0, "Average_Order_Value": 94.72, "Discount_Usage_Rate": 46.4, "Session_Duration_Avg": 27.4, "Cart_Abandonment_Rate": 50.6, "Days_Since_Last_Purchase": 34.0}	2	Khách hàng tiềm năng	1.525176066149531	2026-11-04 18:57:54.248003+07
228c16eb-fb67-4ba8-a499-c00cd8c89689	abe5a49c-9215-4ba1-a73c-5bfcc5ebd797	8b0b7247-65bc-4660-9b61-2ed6298820f6	160f6589-9281-4c66-9e34-5e34d959e368	aceae448-736d-4822-a224-149441d67c08	{"Wishlist_Items": 0.0, "Login_Frequency": 0.0, "Total_Purchases": 5.0, "Mobile_App_Usage": 8.0, "Pages_Per_Session": 2.9, "Average_Order_Value": 118.0, "Discount_Usage_Rate": 46.2, "Session_Duration_Avg": 12.3, "Cart_Abandonment_Rate": 73.5, "Days_Since_Last_Purchase": 23.0}	1	Khách hàng ít tương tác	1.657388151154188	2026-11-05 09:44:46.49192+07
debdbdef-8fe2-41f7-8651-fa1f8e53d214	97a4efa8-95d2-4090-b112-6a3233efb749	8b0b7247-65bc-4660-9b61-2ed6298820f6	5296c492-d639-49b2-b079-ffd975e6fede	fcbf66a3-0563-4767-a279-3b75f0ae4a3e	{"Wishlist_Items": 5.0, "Login_Frequency": 24.0, "Total_Purchases": 20.0, "Mobile_App_Usage": 42.9, "Pages_Per_Session": 13.9, "Average_Order_Value": 169.58, "Discount_Usage_Rate": 27.8, "Session_Duration_Avg": 46.4, "Cart_Abandonment_Rate": 36.2, "Days_Since_Last_Purchase": 10.0}	0	Khách hàng tích cực	2.3288675345786665	2026-11-05 09:47:40.530578+07
9b5f6af8-6b49-4456-a265-1bee2595a455	1eef9113-8c50-4d44-aeed-d48e68653461	8b0b7247-65bc-4660-9b61-2ed6298820f6	163739c8-fa6b-4787-9998-ee64f036abb0	41983682-1ec7-4897-a67e-54c50942bf28	{"Wishlist_Items": 2.0, "Login_Frequency": 14.0, "Total_Purchases": 15.0, "Mobile_App_Usage": 23.3, "Pages_Per_Session": 10.3, "Average_Order_Value": 123.0, "Discount_Usage_Rate": 40.0, "Session_Duration_Avg": 33.5, "Cart_Abandonment_Rate": 48.4, "Days_Since_Last_Purchase": 8.0}	2	Khách hàng tiềm năng	1.3401402934848343	2026-11-05 13:38:03.125569+07
020861fb-913c-45d0-9b80-0473abf7ce3c	1eef9113-8c50-4d44-aeed-d48e68653461	8b0b7247-65bc-4660-9b61-2ed6298820f6	57f69d5a-454f-44dc-87e6-ceed37752554	4be8ac8a-8a3f-4fd6-9bf8-d0e212ea68e3	{"Wishlist_Items": 3.0, "Login_Frequency": 14.0, "Total_Purchases": 9.0, "Mobile_App_Usage": 20.8, "Pages_Per_Session": 6.0, "Average_Order_Value": 94.72, "Discount_Usage_Rate": 46.4, "Session_Duration_Avg": 27.4, "Cart_Abandonment_Rate": 50.6, "Days_Since_Last_Purchase": 34.0}	2	Khách hàng tiềm năng	1.525176066149531	2026-11-05 13:38:03.125569+07
f710eed9-3d55-4d66-9170-f6a999e9791a	1eef9113-8c50-4d44-aeed-d48e68653461	8b0b7247-65bc-4660-9b61-2ed6298820f6	2f53e95b-d728-4eb3-a08e-a0b9525c3ca2	659f1dda-79b9-4971-9f4c-ffe36f9acb38	{"Wishlist_Items": 0.0, "Login_Frequency": 11.0, "Total_Purchases": 5.0, "Mobile_App_Usage": 17.7, "Pages_Per_Session": 5.6, "Average_Order_Value": 78.88, "Discount_Usage_Rate": 72.0, "Session_Duration_Avg": 12.1, "Cart_Abandonment_Rate": 77.2, "Days_Since_Last_Purchase": 36.0}	1	Khách hàng ít tương tác	2.3318865087499767	2026-11-05 13:38:03.125569+07
0f957ebb-7a84-4794-ad5c-959c9a9fc3a9	1eef9113-8c50-4d44-aeed-d48e68653461	8b0b7247-65bc-4660-9b61-2ed6298820f6	e1152b08-1d0a-42b5-b820-542c6a1be3bb	8132853b-d363-452e-802b-c33606f6c154	{"Wishlist_Items": 2.0, "Login_Frequency": 0.0, "Total_Purchases": 11.0, "Mobile_App_Usage": 17.5, "Pages_Per_Session": 9.8, "Average_Order_Value": 103.12, "Discount_Usage_Rate": 6.5, "Session_Duration_Avg": 20.3, "Cart_Abandonment_Rate": 59.8, "Days_Since_Last_Purchase": 5.0}	1	Khách hàng ít tương tác	2.5354839653404944	2026-11-05 13:38:03.125569+07
28a57a6b-24dd-4549-a666-c972afac4075	1eef9113-8c50-4d44-aeed-d48e68653461	8b0b7247-65bc-4660-9b61-2ed6298820f6	160f6589-9281-4c66-9e34-5e34d959e368	aceae448-736d-4822-a224-149441d67c08	{"Wishlist_Items": 0.0, "Login_Frequency": 0.0, "Total_Purchases": 5.0, "Mobile_App_Usage": 8.0, "Pages_Per_Session": 2.9, "Average_Order_Value": 118.0, "Discount_Usage_Rate": 46.2, "Session_Duration_Avg": 12.3, "Cart_Abandonment_Rate": 73.5, "Days_Since_Last_Purchase": 23.0}	1	Khách hàng ít tương tác	1.657388151154188	2026-11-05 13:38:03.125569+07
bf30d12b-1fff-46a3-9a78-c41a631ee527	1eef9113-8c50-4d44-aeed-d48e68653461	8b0b7247-65bc-4660-9b61-2ed6298820f6	dd4e4b7a-6abc-4f13-9248-5a97d610173d	c856127a-ada0-4519-8f49-0e0698fa3111	{"Wishlist_Items": 0.0, "Login_Frequency": 6.0, "Total_Purchases": 12.0, "Mobile_App_Usage": 11.2, "Pages_Per_Session": 6.9, "Average_Order_Value": 190.97, "Discount_Usage_Rate": 60.2, "Session_Duration_Avg": 21.9, "Cart_Abandonment_Rate": 74.4, "Days_Since_Last_Purchase": 29.0}	1	Khách hàng ít tương tác	2.1776799602098276	2026-11-05 13:38:03.125569+07
a601b775-7d0a-4083-bdf4-576e4f91a4ab	1eef9113-8c50-4d44-aeed-d48e68653461	8b0b7247-65bc-4660-9b61-2ed6298820f6	8162c657-ebf3-47d3-82c4-311a988bfb5c	d29947f1-3535-4d4f-9c3d-18497bc688b0	{"Wishlist_Items": 9.0, "Login_Frequency": 10.0, "Total_Purchases": 15.0, "Mobile_App_Usage": 31.0, "Pages_Per_Session": 14.8, "Average_Order_Value": 147.33, "Discount_Usage_Rate": 44.1, "Session_Duration_Avg": 38.4, "Cart_Abandonment_Rate": 41.7, "Days_Since_Last_Purchase": 47.0}	0	Khách hàng tích cực	2.1328245350450996	2026-11-05 13:38:03.125569+07
a17bf06d-6c98-4f2e-8dca-95e65626d696	1eef9113-8c50-4d44-aeed-d48e68653461	8b0b7247-65bc-4660-9b61-2ed6298820f6	4efac273-318c-4742-b381-e07a7d4d63d0	ee6ad2c4-a96e-4ea9-afb5-bb039b1c2629	{"Wishlist_Items": 1.0, "Login_Frequency": 4.0, "Total_Purchases": 4.0, "Mobile_App_Usage": 15.5, "Pages_Per_Session": 3.7, "Average_Order_Value": 116.39, "Discount_Usage_Rate": 42.6, "Session_Duration_Avg": 12.4, "Cart_Abandonment_Rate": 68.5, "Days_Since_Last_Purchase": 78.0}	1	Khách hàng ít tương tác	2.098669047005981	2026-11-05 13:38:03.125569+07
aeb25456-70cd-4cd2-a96a-f4aad9a1e3af	1eef9113-8c50-4d44-aeed-d48e68653461	8b0b7247-65bc-4660-9b61-2ed6298820f6	e7cab491-86a0-487f-b40e-5e5b6d6b2c5d	efdea114-ea80-4b5c-94d2-0590544d3ea0	{"Wishlist_Items": 5.0, "Login_Frequency": 24.0, "Total_Purchases": 18.0, "Mobile_App_Usage": 26.5, "Pages_Per_Session": 18.0, "Average_Order_Value": 91.92, "Discount_Usage_Rate": 83.8, "Session_Duration_Avg": 50.8, "Cart_Abandonment_Rate": 44.0, "Days_Since_Last_Purchase": 55.0}	0	Khách hàng tích cực	3.0593550914448278	2026-11-05 13:38:03.125569+07
dcb8bbc6-6adf-42a8-8f78-4607dc11c101	1eef9113-8c50-4d44-aeed-d48e68653461	8b0b7247-65bc-4660-9b61-2ed6298820f6	5296c492-d639-49b2-b079-ffd975e6fede	fcbf66a3-0563-4767-a279-3b75f0ae4a3e	{"Wishlist_Items": 5.0, "Login_Frequency": 24.0, "Total_Purchases": 20.0, "Mobile_App_Usage": 42.9, "Pages_Per_Session": 13.9, "Average_Order_Value": 169.58, "Discount_Usage_Rate": 27.8, "Session_Duration_Avg": 46.4, "Cart_Abandonment_Rate": 36.2, "Days_Since_Last_Purchase": 10.0}	0	Khách hàng tích cực	2.3288675345786665	2026-11-05 13:38:03.125569+07
a014fdc2-6652-4add-8a8c-ee98505b6d77	6791ccba-4746-4c50-ad50-3319d3720efc	8b0b7247-65bc-4660-9b61-2ed6298820f6	0a9ab69a-3e34-41bd-91bd-2ff1a9611e13	32464d68-d517-4fda-9cdb-e04204f8efe9	{"Wishlist_Items": 8.0, "Login_Frequency": 12.0, "Total_Purchases": 17.0, "Mobile_App_Usage": 28.8, "Pages_Per_Session": 13.3, "Average_Order_Value": 65.22, "Discount_Usage_Rate": 32.3, "Session_Duration_Avg": 42.1, "Cart_Abandonment_Rate": 38.3, "Days_Since_Last_Purchase": 10.0}	0	Khách hàng tích cực	2.0837464048343755	2026-11-16 19:40:00.225992+07
50b8625c-8a21-49b9-a138-9ba5275a88ed	6791ccba-4746-4c50-ad50-3319d3720efc	8b0b7247-65bc-4660-9b61-2ed6298820f6	727ec9c1-79ad-4c07-acfe-8daf9690fb2c	3ea17821-fe0c-467b-8ee4-d8a1716c8db4	{"Wishlist_Items": 9.0, "Login_Frequency": 10.0, "Total_Purchases": 15.0, "Mobile_App_Usage": 31.0, "Pages_Per_Session": 14.8, "Average_Order_Value": 147.33, "Discount_Usage_Rate": 44.1, "Session_Duration_Avg": 38.4, "Cart_Abandonment_Rate": 41.7, "Days_Since_Last_Purchase": 47.0}	0	Khách hàng tích cực	2.1328245350450996	2026-11-16 19:40:00.225992+07
608836e9-2434-4891-bb7b-a925cdff4ee6	6791ccba-4746-4c50-ad50-3319d3720efc	8b0b7247-65bc-4660-9b61-2ed6298820f6	31c63922-7346-414c-8346-deae09984763	71a3fc19-abba-49d9-a693-c3acaed40168	{"Wishlist_Items": 4.0, "Login_Frequency": 7.0, "Total_Purchases": 10.0, "Mobile_App_Usage": 18.9, "Pages_Per_Session": 12.2, "Average_Order_Value": 150.38, "Discount_Usage_Rate": 71.3, "Session_Duration_Avg": 25.9, "Cart_Abandonment_Rate": 62.5, "Days_Since_Last_Purchase": 24.0}	2	Khách hàng tiềm năng	2.1909932440234257	2026-11-16 19:40:00.225992+07
9c9dbb3f-890d-4f78-b7c4-6fe72bc0c863	6791ccba-4746-4c50-ad50-3319d3720efc	8b0b7247-65bc-4660-9b61-2ed6298820f6	ca7c6bc9-5e44-424f-8fe2-75c5b00201a0	a06ed6d7-559b-4f15-ba70-719f1a96648d	{"Wishlist_Items": 9.0, "Login_Frequency": 24.0, "Total_Purchases": 24.0, "Mobile_App_Usage": 37.8, "Pages_Per_Session": 16.0, "Average_Order_Value": 108.52, "Discount_Usage_Rate": 33.0, "Session_Duration_Avg": 50.3, "Cart_Abandonment_Rate": 25.2, "Days_Since_Last_Purchase": 4.0}	0	Khách hàng tích cực	1.8817038727797626	2026-11-16 19:40:00.225992+07
37d62946-d10b-484a-b326-afda84362b20	a28ed553-cb21-40d5-a450-f3c6c339463a	8b0b7247-65bc-4660-9b61-2ed6298820f6	512e5df4-5b71-4063-86b2-bf4383fa076c	00df99b7-d3c2-448e-a3cf-136f052188e1	{"Wishlist_Items": 1.0, "Login_Frequency": 3.0, "Total_Purchases": 7.800000000000001, "Mobile_App_Usage": 16.9, "Pages_Per_Session": 7.4, "Average_Order_Value": 178.42, "Discount_Usage_Rate": 20.279999999999998, "Session_Duration_Avg": 17.7, "Cart_Abandonment_Rate": 59.2, "Days_Since_Last_Purchase": 5.0}	1	Khách hàng ít tương tác	2.185101579868936	2026-11-19 19:32:49.776339+07
66d56de5-8e77-49a9-a73a-8a05e4c711a8	a28ed553-cb21-40d5-a450-f3c6c339463a	8b0b7247-65bc-4660-9b61-2ed6298820f6	f770ce3f-2c85-41d6-b30e-55e2cde77409	01dba1fc-b97c-4186-be58-cd7777eb89a5	{"Wishlist_Items": 5.0, "Login_Frequency": 9.0, "Total_Purchases": 6.0, "Mobile_App_Usage": 15.5, "Pages_Per_Session": 5.1, "Average_Order_Value": 121.45, "Discount_Usage_Rate": 21.6, "Session_Duration_Avg": 16.3, "Cart_Abandonment_Rate": 62.3, "Days_Since_Last_Purchase": 1.0}	1	Khách hàng ít tương tác	1.8773950991332693	2026-11-19 19:32:49.776339+07
cc6bafaa-f955-4612-a945-2d039b8c2d4d	a28ed553-cb21-40d5-a450-f3c6c339463a	8b0b7247-65bc-4660-9b61-2ed6298820f6	7c99aa26-bd79-4af6-b3a6-c12d584a74a3	1aa63836-efcd-4e55-80f3-55e1371df090	{"Wishlist_Items": 4.0, "Login_Frequency": 13.0, "Total_Purchases": 8.0, "Mobile_App_Usage": 19.4, "Pages_Per_Session": 11.2, "Average_Order_Value": 96.62, "Discount_Usage_Rate": 30.3, "Session_Duration_Avg": 26.6, "Cart_Abandonment_Rate": 63.1, "Days_Since_Last_Purchase": 65.0}	2	Khách hàng tiềm năng	1.9405817189423615	2026-11-19 19:32:49.776339+07
1827fe81-5153-4e0a-a076-89fbf28f8ad3	a28ed553-cb21-40d5-a450-f3c6c339463a	8b0b7247-65bc-4660-9b61-2ed6298820f6	60ecc394-6aa6-491e-a094-cbb3dc6a48e9	85d60df5-5232-449c-ad18-0f0fb46bf583	{"Wishlist_Items": 1.0, "Login_Frequency": 18.0, "Total_Purchases": 11.0, "Mobile_App_Usage": 7.5, "Pages_Per_Session": 9.9, "Average_Order_Value": 145.04, "Discount_Usage_Rate": 62.0, "Session_Duration_Avg": 27.0, "Cart_Abandonment_Rate": 51.5, "Days_Since_Last_Purchase": 68.0}	2	Khách hàng tiềm năng	2.7491210609838745	2026-11-19 19:32:49.776339+07
c6451bc3-a3d1-4f33-8fa0-39c8ebf74d9f	a28ed553-cb21-40d5-a450-f3c6c339463a	8b0b7247-65bc-4660-9b61-2ed6298820f6	45a52008-364c-4668-b267-e9a1e68cb835	cdc5c880-352e-40d1-8c7d-a993b2b39df5	{"Wishlist_Items": 5.0, "Login_Frequency": 8.0, "Total_Purchases": 12.0, "Mobile_App_Usage": 11.5, "Pages_Per_Session": 6.5, "Average_Order_Value": 125.34, "Discount_Usage_Rate": 55.7, "Session_Duration_Avg": 24.0, "Cart_Abandonment_Rate": 51.5, "Days_Since_Last_Purchase": 34.0}	2	Khách hàng tiềm năng	1.7354740535438173	2026-11-19 19:32:49.776339+07
edc48ddc-1ff1-4fde-bcae-7bd96aa328e4	a28ed553-cb21-40d5-a450-f3c6c339463a	8b0b7247-65bc-4660-9b61-2ed6298820f6	35a65074-15a4-471a-b62d-560656bb7cc0	e6c8f581-ea52-4197-b14d-bde1a5f4cec9	{"Wishlist_Items": 4.0, "Login_Frequency": 0.0, "Total_Purchases": 6.0, "Mobile_App_Usage": 19.9, "Pages_Per_Session": 5.1, "Average_Order_Value": 199.48, "Discount_Usage_Rate": 47.8, "Session_Duration_Avg": 33.0, "Cart_Abandonment_Rate": 75.1, "Days_Since_Last_Purchase": 43.0}	1	Khách hàng ít tương tác	2.7077360995203246	2026-11-19 19:32:49.776339+07
70780b8c-ea7b-40fe-9079-52891964d400	a28ed553-cb21-40d5-a450-f3c6c339463a	8b0b7247-65bc-4660-9b61-2ed6298820f6	dbd047a8-f3e5-475c-8acd-b009407de2e1	f137ef20-f5f3-4ab3-adaa-a3b95bde5caa	{"Wishlist_Items": 5.0, "Login_Frequency": 23.0, "Total_Purchases": 15.0, "Mobile_App_Usage": 27.8, "Pages_Per_Session": 14.2, "Average_Order_Value": 111.93, "Discount_Usage_Rate": 25.1, "Session_Duration_Avg": 44.6, "Cart_Abandonment_Rate": 46.8, "Days_Since_Last_Purchase": 48.0}	0	Khách hàng tích cực	1.9419266996977866	2026-11-19 19:32:49.776339+07
6c14bcfe-3e6b-4291-b6b4-72cb1de7e870	a28ed553-cb21-40d5-a450-f3c6c339463a	8b0b7247-65bc-4660-9b61-2ed6298820f6	946fe89f-61ca-41a3-b193-878471e439c2	fdf9215b-960a-44d3-98f9-6683a2c590f7	{"Wishlist_Items": 14.0, "Login_Frequency": 29.0, "Total_Purchases": 22.0, "Mobile_App_Usage": 39.6, "Pages_Per_Session": 15.9, "Average_Order_Value": 134.1, "Discount_Usage_Rate": 22.2, "Session_Duration_Avg": 48.9, "Cart_Abandonment_Rate": 27.8, "Days_Since_Last_Purchase": 34.0}	0	Khách hàng tích cực	2.790252041991509	2026-11-19 19:32:49.776339+07
3b5e1cf7-b331-495c-9912-a3345dd81c97	5212432c-e88f-43ca-9b7c-034323b89095	8b0b7247-65bc-4660-9b61-2ed6298820f6	35a65074-15a4-471a-b62d-560656bb7cc0	e6c8f581-ea52-4197-b14d-bde1a5f4cec9	{"Wishlist_Items": 4.0, "Login_Frequency": 0.0, "Total_Purchases": 6.0, "Mobile_App_Usage": 19.9, "Pages_Per_Session": 5.1, "Average_Order_Value": 199.48, "Discount_Usage_Rate": 47.8, "Session_Duration_Avg": 33.0, "Cart_Abandonment_Rate": 75.1, "Days_Since_Last_Purchase": 43.0}	1	Khách hàng ít tương tác	2.707736099520325	2026-11-20 18:09:43.851675+07
dfecb4e8-bb61-455f-951f-f0b7b99b0171	ed9f9b2f-36f9-430c-83e1-fa86bcec873e	8b0b7247-65bc-4660-9b61-2ed6298820f6	508fb791-a1f7-4b16-b012-3d62d176bde6	1348daf1-bd90-452d-a65e-97184357ea76	{"Wishlist_Items": 9.0, "Login_Frequency": 10.0, "Total_Purchases": 15.0, "Mobile_App_Usage": 31.0, "Pages_Per_Session": 14.8, "Average_Order_Value": 147.33, "Discount_Usage_Rate": 44.1, "Session_Duration_Avg": 38.4, "Cart_Abandonment_Rate": 41.7, "Days_Since_Last_Purchase": 47.0}	0	Khách hàng tích cực	2.1328245350450996	2026-11-24 20:08:08.510814+07
f8d6bd2b-8cb7-4a01-bc16-a7496511b833	ed9f9b2f-36f9-430c-83e1-fa86bcec873e	8b0b7247-65bc-4660-9b61-2ed6298820f6	4ccfd8f9-e500-4706-973a-3bbd09e63e74	5468500a-0345-4c3e-947f-117d267b4496	{"Wishlist_Items": 8.0, "Login_Frequency": 12.0, "Total_Purchases": 17.0, "Mobile_App_Usage": 28.8, "Pages_Per_Session": 13.3, "Average_Order_Value": 65.22, "Discount_Usage_Rate": 32.3, "Session_Duration_Avg": 42.1, "Cart_Abandonment_Rate": 38.3, "Days_Since_Last_Purchase": 10.0}	0	Khách hàng tích cực	2.0837464048343755	2026-11-24 20:08:08.510814+07
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, username, display_name, password_hash, role, is_active, must_change_password, security_version, row_version, failed_attempts, failure_window_started_at, locked_until, last_login_at, password_changed_at, created_at, updated_at, created_by_user_id, updated_by_user_id) FROM stdin;
5d4b6121-7923-44b5-81d0-5503f965de0b	minhky	admin	$argon2id$v=19$m=19456,t=2,p=1$9/zWznaGA9GaY4E9STrZJA$6AOB6+Ln8kOksRw0Ihq6EVYw1P8UdTBaVEPpM4VAPEs	ADMIN	t	f	2	2	0	\N	\N	\N	2026-11-03 19:53:27.696061+07	2026-11-03 19:48:57.506336+07	2026-11-03 19:53:27.696061+07	\N	5d4b6121-7923-44b5-81d0-5503f965de0b
ef370823-0afe-4928-b9a6-a682b68bf84b	operator1	Nhân viên thử nghiệm	$argon2id$v=19$m=19456,t=2,p=1$EkjOJpW3SqRGIkTgH/hD7Q$v5DFPySNCx3V/C2Jb5sL2u6n17dLKDhrPJLdXmEEDhI	OPERATOR	t	f	2	2	0	\N	\N	\N	2026-11-03 20:06:40.764886+07	2026-11-03 19:58:39.918514+07	2026-11-03 20:06:40.764886+07	5d4b6121-7923-44b5-81d0-5503f965de0b	ef370823-0afe-4928-b9a6-a682b68bf84b
793c8008-9a11-4159-a311-c82ffad442a7	demo	demo	$argon2id$v=19$m=19456,t=2,p=1$fvGGUDEKJQNgy3lRqh9m7g$qFMYjGsgLF9TjLvoduN6PS7Q9YogqaKIIcRKNa+Ok/s	VIEWER	t	f	2	2	0	\N	\N	\N	2026-11-19 20:10:33.720783+07	2026-11-19 20:10:04.324825+07	2026-11-19 20:10:33.720783+07	5d4b6121-7923-44b5-81d0-5503f965de0b	793c8008-9a11-4159-a311-c82ffad442a7
65689d20-6b3a-4fc3-abb3-b972f9a13275	viewer1	Người xem thử nghiệm	$argon2id$v=19$m=19456,t=2,p=1$fvGGUDEKJQNgy3lRqh9m7g$qFMYjGsgLF9TjLvoduN6PS7Q9YogqaKIIcRKNa+Ok/s	VIEWER	t	f	4	4	0	\N	\N	\N	2026-11-18 20:33:15.222194+07	2026-11-03 19:59:47.99683+07	2026-11-18 20:33:15.222194+07	5d4b6121-7923-44b5-81d0-5503f965de0b	65689d20-6b3a-4fc3-abb3-b972f9a13275
679a47d2-584b-4cd7-b3af-790958cffffb	demo2	demo2	$argon2id$v=19$m=19456,t=2,p=1$fvGGUDEKJQNgy3lRqh9m7g$qFMYjGsgLF9TjLvoduN6PS7Q9YogqaKIIcRKNa+Ok/s	VIEWER	t	f	2	2	0	\N	\N	\N	2026-11-20 18:15:54.232166+07	2026-11-20 18:15:25.891101+07	2026-11-20 18:15:54.232166+07	5d4b6121-7923-44b5-81d0-5503f965de0b	679a47d2-584b-4cd7-b3af-790958cffffb
\.


--
-- Name: alembic_version alembic_version_pkc; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alembic_version
    ADD CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num);


--
-- Name: ml_models model_name_version; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ml_models
    ADD CONSTRAINT model_name_version UNIQUE (name, version);


--
-- Name: auth_audit_events pk_auth_audit_events; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_audit_events
    ADD CONSTRAINT pk_auth_audit_events PRIMARY KEY (id);


--
-- Name: auth_sessions pk_auth_sessions; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_sessions
    ADD CONSTRAINT pk_auth_sessions PRIMARY KEY (id);


--
-- Name: bulk_analysis_items pk_bulk_analysis_items; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bulk_analysis_items
    ADD CONSTRAINT pk_bulk_analysis_items PRIMARY KEY (id);


--
-- Name: bulk_analysis_jobs pk_bulk_analysis_jobs; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bulk_analysis_jobs
    ADD CONSTRAINT pk_bulk_analysis_jobs PRIMARY KEY (id);


--
-- Name: bulk_import_jobs pk_bulk_import_jobs; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bulk_import_jobs
    ADD CONSTRAINT pk_bulk_import_jobs PRIMARY KEY (id);


--
-- Name: bulk_import_rows pk_bulk_import_rows; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bulk_import_rows
    ADD CONSTRAINT pk_bulk_import_rows PRIMARY KEY (id);


--
-- Name: customer_behavior_snapshots pk_customer_behavior_snapshots; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_behavior_snapshots
    ADD CONSTRAINT pk_customer_behavior_snapshots PRIMARY KEY (id);


--
-- Name: customer_source_identities pk_customer_source_identities; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_source_identities
    ADD CONSTRAINT pk_customer_source_identities PRIMARY KEY (id);


--
-- Name: customers pk_customers; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT pk_customers PRIMARY KEY (id);


--
-- Name: ml_models pk_ml_models; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ml_models
    ADD CONSTRAINT pk_ml_models PRIMARY KEY (id);


--
-- Name: prediction_results pk_prediction_results; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prediction_results
    ADD CONSTRAINT pk_prediction_results PRIMARY KEY (id);


--
-- Name: prediction_runs pk_prediction_runs; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prediction_runs
    ADD CONSTRAINT pk_prediction_runs PRIMARY KEY (id);


--
-- Name: prediction_scenarios pk_prediction_scenarios; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prediction_scenarios
    ADD CONSTRAINT pk_prediction_scenarios PRIMARY KEY (id);


--
-- Name: scenario_results pk_scenario_results; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_results
    ADD CONSTRAINT pk_scenario_results PRIMARY KEY (id);


--
-- Name: segmentation_results pk_segmentation_results; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.segmentation_results
    ADD CONSTRAINT pk_segmentation_results PRIMARY KEY (id);


--
-- Name: users pk_users; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT pk_users PRIMARY KEY (id);


--
-- Name: bulk_analysis_items uq_analysis_job_snapshot; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bulk_analysis_items
    ADD CONSTRAINT uq_analysis_job_snapshot UNIQUE (job_id, snapshot_id);


--
-- Name: bulk_analysis_jobs uq_analysis_plan; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bulk_analysis_jobs
    ADD CONSTRAINT uq_analysis_plan UNIQUE (plan_key);


--
-- Name: bulk_analysis_items uq_analysis_saved_snapshot; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bulk_analysis_items
    ADD CONSTRAINT uq_analysis_saved_snapshot UNIQUE (dedupe_key);


--
-- Name: auth_sessions uq_auth_session_digest; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_sessions
    ADD CONSTRAINT uq_auth_session_digest UNIQUE (session_token_hash);


--
-- Name: users uq_auth_users_username; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT uq_auth_users_username UNIQUE (username);


--
-- Name: bulk_import_jobs uq_bulk_actor_request; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bulk_import_jobs
    ADD CONSTRAINT uq_bulk_actor_request UNIQUE (actor_user_id, idempotency_key);


--
-- Name: bulk_import_rows uq_bulk_job_row; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bulk_import_rows
    ADD CONSTRAINT uq_bulk_job_row UNIQUE (job_id, row_number);


--
-- Name: bulk_import_rows uq_bulk_snapshot_dedupe; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bulk_import_rows
    ADD CONSTRAINT uq_bulk_snapshot_dedupe UNIQUE (snapshot_dedupe_key);


--
-- Name: customer_source_identities uq_bulk_source_identity; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_source_identities
    ADD CONSTRAINT uq_bulk_source_identity UNIQUE (source_system, external_customer_id);


--
-- Name: customers uq_customers_external_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT uq_customers_external_id UNIQUE (external_id);


--
-- Name: ix_auth_audit_actor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_auth_audit_actor ON public.auth_audit_events USING btree (actor_user_id, occurred_at, id);


--
-- Name: ix_auth_audit_resource; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_auth_audit_resource ON public.auth_audit_events USING btree (resource_type, resource_id, occurred_at);


--
-- Name: ix_auth_audit_subject; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_auth_audit_subject ON public.auth_audit_events USING btree (subject_user_id, occurred_at, id);


--
-- Name: ix_auth_audit_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_auth_audit_time ON public.auth_audit_events USING btree (occurred_at, id);


--
-- Name: ix_auth_sessions_expiry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_auth_sessions_expiry ON public.auth_sessions USING btree (expires_at);


--
-- Name: ix_auth_sessions_preauth; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_auth_sessions_preauth ON public.auth_sessions USING btree (expires_at) WHERE ((state)::text = 'preauth'::text);


--
-- Name: ix_auth_sessions_user_live; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_auth_sessions_user_live ON public.auth_sessions USING btree (user_id, expires_at) WHERE (revoked_at IS NULL);


--
-- Name: ix_auth_users_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_auth_users_created ON public.users USING btree (created_at, id);


--
-- Name: ix_auth_users_role_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_auth_users_role_active ON public.users USING btree (role, is_active);


--
-- Name: ix_behavior_customer_captured_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_behavior_customer_captured_at ON public.customer_behavior_snapshots USING btree (customer_id, captured_at);


--
-- Name: ix_bulk_analysis_items_job_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_bulk_analysis_items_job_id ON public.bulk_analysis_items USING btree (job_id);


--
-- Name: ix_bulk_analysis_jobs_actor_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_bulk_analysis_jobs_actor_user_id ON public.bulk_analysis_jobs USING btree (actor_user_id);


--
-- Name: ix_bulk_analysis_jobs_import_job_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_bulk_analysis_jobs_import_job_id ON public.bulk_analysis_jobs USING btree (import_job_id);


--
-- Name: ix_bulk_import_rows_job_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_bulk_import_rows_job_id ON public.bulk_import_rows USING btree (job_id);


--
-- Name: ix_bulk_jobs_actor_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_bulk_jobs_actor_created ON public.bulk_import_jobs USING btree (actor_user_id, created_at, id);


--
-- Name: ix_customer_source_identities_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_customer_source_identities_customer_id ON public.customer_source_identities USING btree (customer_id);


--
-- Name: ix_customers_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_customers_is_active ON public.customers USING btree (is_active);


--
-- Name: ix_ml_models_task_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_ml_models_task_active ON public.ml_models USING btree (task, is_active);


--
-- Name: ix_prediction_results_customer_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_prediction_results_customer_created ON public.prediction_results USING btree (customer_id, created_at);


--
-- Name: ix_prediction_results_run; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_prediction_results_run ON public.prediction_results USING btree (run_id);


--
-- Name: ix_prediction_runs_task_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_prediction_runs_task_created ON public.prediction_runs USING btree (task, created_at);


--
-- Name: ix_scenario_results_scenario_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_scenario_results_scenario_created ON public.scenario_results USING btree (scenario_id, created_at);


--
-- Name: ix_scenarios_customer_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_scenarios_customer_created ON public.prediction_scenarios USING btree (customer_id, created_at);


--
-- Name: ix_segmentation_results_customer_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_segmentation_results_customer_created ON public.segmentation_results USING btree (customer_id, created_at);


--
-- Name: ix_segmentation_results_run; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_segmentation_results_run ON public.segmentation_results USING btree (run_id);


--
-- Name: uq_auth_audit_creation; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_auth_audit_creation ON public.auth_audit_events USING btree (resource_type, resource_id) WHERE (((event_code)::text = 'business.created'::text) AND ((outcome)::text = 'success'::text));


--
-- Name: auth_audit_events fk_auth_audit_events_actor_user_id_users; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_audit_events
    ADD CONSTRAINT fk_auth_audit_events_actor_user_id_users FOREIGN KEY (actor_user_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: auth_audit_events fk_auth_audit_events_session_id_auth_sessions; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_audit_events
    ADD CONSTRAINT fk_auth_audit_events_session_id_auth_sessions FOREIGN KEY (session_id) REFERENCES public.auth_sessions(id) ON DELETE SET NULL;


--
-- Name: auth_audit_events fk_auth_audit_events_subject_user_id_users; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_audit_events
    ADD CONSTRAINT fk_auth_audit_events_subject_user_id_users FOREIGN KEY (subject_user_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: auth_sessions fk_auth_sessions_user_id_users; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_sessions
    ADD CONSTRAINT fk_auth_sessions_user_id_users FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: bulk_analysis_items fk_bulk_analysis_items_customer_id_customers; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bulk_analysis_items
    ADD CONSTRAINT fk_bulk_analysis_items_customer_id_customers FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE RESTRICT;


--
-- Name: bulk_analysis_items fk_bulk_analysis_items_job_id_bulk_analysis_jobs; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bulk_analysis_items
    ADD CONSTRAINT fk_bulk_analysis_items_job_id_bulk_analysis_jobs FOREIGN KEY (job_id) REFERENCES public.bulk_analysis_jobs(id) ON DELETE RESTRICT;


--
-- Name: bulk_analysis_items fk_bulk_analysis_items_prediction_result_id_prediction_results; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bulk_analysis_items
    ADD CONSTRAINT fk_bulk_analysis_items_prediction_result_id_prediction_results FOREIGN KEY (prediction_result_id) REFERENCES public.prediction_results(id) ON DELETE RESTRICT;


--
-- Name: bulk_analysis_items fk_bulk_analysis_items_segmentation_result_id_segmentat_377c; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bulk_analysis_items
    ADD CONSTRAINT fk_bulk_analysis_items_segmentation_result_id_segmentat_377c FOREIGN KEY (segmentation_result_id) REFERENCES public.segmentation_results(id) ON DELETE RESTRICT;


--
-- Name: bulk_analysis_items fk_bulk_analysis_items_snapshot_id_customer_behavior_snapshots; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bulk_analysis_items
    ADD CONSTRAINT fk_bulk_analysis_items_snapshot_id_customer_behavior_snapshots FOREIGN KEY (snapshot_id) REFERENCES public.customer_behavior_snapshots(id) ON DELETE RESTRICT;


--
-- Name: bulk_analysis_jobs fk_bulk_analysis_jobs_actor_user_id_users; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bulk_analysis_jobs
    ADD CONSTRAINT fk_bulk_analysis_jobs_actor_user_id_users FOREIGN KEY (actor_user_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: bulk_analysis_jobs fk_bulk_analysis_jobs_import_job_id_bulk_import_jobs; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bulk_analysis_jobs
    ADD CONSTRAINT fk_bulk_analysis_jobs_import_job_id_bulk_import_jobs FOREIGN KEY (import_job_id) REFERENCES public.bulk_import_jobs(id) ON DELETE RESTRICT;


--
-- Name: bulk_import_jobs fk_bulk_import_jobs_actor_user_id_users; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bulk_import_jobs
    ADD CONSTRAINT fk_bulk_import_jobs_actor_user_id_users FOREIGN KEY (actor_user_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: bulk_import_rows fk_bulk_import_rows_customer_id_customers; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bulk_import_rows
    ADD CONSTRAINT fk_bulk_import_rows_customer_id_customers FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE RESTRICT;


--
-- Name: bulk_import_rows fk_bulk_import_rows_job_id_bulk_import_jobs; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bulk_import_rows
    ADD CONSTRAINT fk_bulk_import_rows_job_id_bulk_import_jobs FOREIGN KEY (job_id) REFERENCES public.bulk_import_jobs(id) ON DELETE RESTRICT;


--
-- Name: bulk_import_rows fk_bulk_import_rows_snapshot_id_customer_behavior_snapshots; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bulk_import_rows
    ADD CONSTRAINT fk_bulk_import_rows_snapshot_id_customer_behavior_snapshots FOREIGN KEY (snapshot_id) REFERENCES public.customer_behavior_snapshots(id) ON DELETE RESTRICT;


--
-- Name: customer_behavior_snapshots fk_customer_behavior_snapshots_customer_id_customers; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_behavior_snapshots
    ADD CONSTRAINT fk_customer_behavior_snapshots_customer_id_customers FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: customer_source_identities fk_customer_source_identities_customer_id_customers; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_source_identities
    ADD CONSTRAINT fk_customer_source_identities_customer_id_customers FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE RESTRICT;


--
-- Name: prediction_results fk_prediction_results_behavior_snapshot_id_customer_beh_7e25; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prediction_results
    ADD CONSTRAINT fk_prediction_results_behavior_snapshot_id_customer_beh_7e25 FOREIGN KEY (behavior_snapshot_id) REFERENCES public.customer_behavior_snapshots(id) ON DELETE SET NULL;


--
-- Name: prediction_results fk_prediction_results_customer_id_customers; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prediction_results
    ADD CONSTRAINT fk_prediction_results_customer_id_customers FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;


--
-- Name: prediction_results fk_prediction_results_model_id_ml_models; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prediction_results
    ADD CONSTRAINT fk_prediction_results_model_id_ml_models FOREIGN KEY (model_id) REFERENCES public.ml_models(id) ON DELETE RESTRICT;


--
-- Name: prediction_results fk_prediction_results_run_id_prediction_runs; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prediction_results
    ADD CONSTRAINT fk_prediction_results_run_id_prediction_runs FOREIGN KEY (run_id) REFERENCES public.prediction_runs(id) ON DELETE CASCADE;


--
-- Name: prediction_runs fk_prediction_runs_model_id_ml_models; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prediction_runs
    ADD CONSTRAINT fk_prediction_runs_model_id_ml_models FOREIGN KEY (model_id) REFERENCES public.ml_models(id) ON DELETE RESTRICT;


--
-- Name: prediction_scenarios fk_prediction_scenarios_baseline_snapshot_id_customer_b_697f; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prediction_scenarios
    ADD CONSTRAINT fk_prediction_scenarios_baseline_snapshot_id_customer_b_697f FOREIGN KEY (baseline_snapshot_id) REFERENCES public.customer_behavior_snapshots(id) ON DELETE SET NULL;


--
-- Name: prediction_scenarios fk_prediction_scenarios_customer_id_customers; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prediction_scenarios
    ADD CONSTRAINT fk_prediction_scenarios_customer_id_customers FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;


--
-- Name: scenario_results fk_scenario_results_baseline_prediction_result_id_predi_6621; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_results
    ADD CONSTRAINT fk_scenario_results_baseline_prediction_result_id_predi_6621 FOREIGN KEY (baseline_prediction_result_id) REFERENCES public.prediction_results(id) ON DELETE SET NULL;


--
-- Name: scenario_results fk_scenario_results_model_id_ml_models; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_results
    ADD CONSTRAINT fk_scenario_results_model_id_ml_models FOREIGN KEY (model_id) REFERENCES public.ml_models(id) ON DELETE RESTRICT;


--
-- Name: scenario_results fk_scenario_results_scenario_id_prediction_scenarios; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_results
    ADD CONSTRAINT fk_scenario_results_scenario_id_prediction_scenarios FOREIGN KEY (scenario_id) REFERENCES public.prediction_scenarios(id) ON DELETE CASCADE;


--
-- Name: segmentation_results fk_segmentation_results_behavior_snapshot_id_customer_b_1043; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.segmentation_results
    ADD CONSTRAINT fk_segmentation_results_behavior_snapshot_id_customer_b_1043 FOREIGN KEY (behavior_snapshot_id) REFERENCES public.customer_behavior_snapshots(id) ON DELETE SET NULL;


--
-- Name: segmentation_results fk_segmentation_results_customer_id_customers; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.segmentation_results
    ADD CONSTRAINT fk_segmentation_results_customer_id_customers FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;


--
-- Name: segmentation_results fk_segmentation_results_model_id_ml_models; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.segmentation_results
    ADD CONSTRAINT fk_segmentation_results_model_id_ml_models FOREIGN KEY (model_id) REFERENCES public.ml_models(id) ON DELETE RESTRICT;


--
-- Name: segmentation_results fk_segmentation_results_run_id_prediction_runs; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.segmentation_results
    ADD CONSTRAINT fk_segmentation_results_run_id_prediction_runs FOREIGN KEY (run_id) REFERENCES public.prediction_runs(id) ON DELETE CASCADE;


--
-- Name: users fk_users_created_by_user_id_users; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT fk_users_created_by_user_id_users FOREIGN KEY (created_by_user_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: users fk_users_updated_by_user_id_users; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT fk_users_updated_by_user_id_users FOREIGN KEY (updated_by_user_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- PostgreSQL database dump complete
--

