--
-- PostgreSQL database dump
--

\restrict 75Nu67gGov4XEqVDfngpiyOklsHBNBH2n0dvNkPxrCHrhukizN3AqI3WTbAYjdR

-- Dumped from database version 16.10
-- Dumped by pg_dump version 16.10

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

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: alert_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alert_configs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    subject_product_id text NOT NULL,
    lookup_product_ids jsonb DEFAULT '[]'::jsonb NOT NULL,
    display_message text DEFAULT ''::text NOT NULL,
    delay_seconds integer DEFAULT 5 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    lookup_logic text DEFAULT 'and'::text NOT NULL,
    info_only boolean DEFAULT false NOT NULL
);


--
-- Name: app_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_settings (
    key text NOT NULL,
    value text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: login_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.login_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    email text NOT NULL,
    ip_address text,
    user_agent text,
    success boolean NOT NULL,
    failure_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: media_files; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.media_files (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    original_name text NOT NULL,
    slug text NOT NULL,
    path text NOT NULL,
    uploaded_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: pit_catalog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pit_catalog (
    id text NOT NULL,
    data jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: product_catalog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_catalog (
    id text NOT NULL,
    data jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: quotes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quotes (
    id character varying(36) NOT NULL,
    user_id uuid NOT NULL,
    data jsonb NOT NULL,
    quote_number text,
    company_name text,
    customer_name text,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    updated_by_user_id uuid,
    updated_by_name text,
    pass_status text
);


--
-- Name: release_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.release_notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    subject text DEFAULT ''::text NOT NULL,
    message text DEFAULT ''::text NOT NULL,
    recipient_emails jsonb DEFAULT '[]'::jsonb NOT NULL,
    sent_at timestamp with time zone,
    sent_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    session_token text NOT NULL,
    ip_address text,
    user_agent text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_active_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL
);


--
-- Name: status_pass_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.status_pass_config (
    id text NOT NULL,
    data jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    password_hash text NOT NULL,
    full_name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    role text DEFAULT 'user'::text NOT NULL
);


--
-- Name: verification_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.verification_codes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    code text NOT NULL,
    type text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Data for Name: alert_configs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.alert_configs (id, subject_product_id, lookup_product_ids, display_message, delay_seconds, is_active, created_at, updated_at, lookup_logic, info_only) FROM stdin;
4ae939ea-9b6c-4a02-a6ad-961026330d0a	co-001	["tm-001", "tm-002", "ta-001", "ta-002", "ta-003"]	Please ensure the number of Aloha Essentials licenses matches the total number of terminals and tablets.	5	t	2026-04-22 23:01:09.750988+00	2026-04-22 23:01:09.750988+00	and	f
\.


--
-- Data for Name: app_settings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.app_settings (key, value, updated_at) FROM stdin;
app_version	6.1	2026-05-04 10:30:05.408071+00
\.


--
-- Data for Name: login_events; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.login_events (id, user_id, email, ip_address, user_agent, success, failure_reason, created_at) FROM stdin;
696f14a1-0b63-4970-8522-5742e69e79d5	6cb81f26-5122-4116-9459-075b163a1568	nenad.jelic@ncrvoyix.com	109.245.146.50	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	t	\N	2026-05-07 07:17:35.570113+00
\.


--
-- Data for Name: media_files; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.media_files (id, original_name, slug, path, uploaded_at) FROM stdin;
b379fbaa-546c-4097-a004-9c252810215b	6200.png	6200.png	/api/images/products/6200.png	2026-04-22 16:33:25.855083+00
84a13164-9d2c-48e7-95ae-f030cd41fd67	6200m.png	6200m.png	/api/images/products/6200m.png	2026-04-22 16:33:26.618479+00
5c688aae-8c64-4da2-b707-6f8957384950	axiumclip-png-1776802047224.png	axiumclip-png-1776802047224.png	/api/images/products/axiumclip-png-1776802047224.png	2026-04-22 16:33:28.48108+00
d7461749-735d-4000-bbe0-5ff9f0404903	axiumstrap-png-1776802057822.png	axiumstrap-png-1776802057822.png	/api/images/products/axiumstrap-png-1776802057822.png	2026-04-22 16:33:29.227438+00
0cbe87d4-958c-42ca-89b6-9dcc3342ca60	cx5-png-1776801982742.png	cx5-png-1776801982742.png	/api/images/products/cx5-png-1776801982742.png	2026-04-22 16:33:29.762445+00
602314c4-49ba-4772-9bff-36c5078ecfbf	kvm2.png	kvm2.png	/api/images/products/kvm2.png	2026-04-22 16:33:30.862398+00
89704fa5-4b98-4790-a59d-9cd98be3f0dd	kvm4.png	kvm4.png	/api/images/products/kvm4.png	2026-04-22 16:33:31.619064+00
a3fd0ed5-a9a6-4e6b-8c4d-83594ffcfa27	ms16-png-1776802093205.png	ms16-png-1776802093205.png	/api/images/products/ms16-png-1776802093205.png	2026-04-22 16:33:32.072204+00
9786bfd0-4643-47f5-a267-6d479e119272	ms16till-png-1776802012846.png	ms16till-png-1776802012846.png	/api/images/products/ms16till-png-1776802012846.png	2026-04-22 16:33:32.98181+00
44dcd779-df55-4b0b-bebc-80e216dbc438	s300-png-1776802119971.png	s300-png-1776802119971.png	/api/images/products/s300-png-1776802119971.png	2026-04-22 16:33:34.832672+00
49d4578e-f195-46a0-9adf-6b7ab1263986	srp275iii-png-1776802149552.png	srp275iii-png-1776802149552.png	/api/images/products/srp275iii-png-1776802149552.png	2026-04-22 16:33:36.200521+00
a3e56c46-a317-41f5-a0d1-e9b513e9d1cb	srp350v-png-1776802130855.png	srp350v-png-1776802130855.png	/api/images/products/srp350v-png-1776802130855.png	2026-04-22 16:33:36.937026+00
66ec1313-fdb7-4bc1-8f84-d14c09c71116	5bayaxium-png-1776932543064.png	5bayaxium-png-1776932543064.png	/api/images/products/5bayaxium-png-1776932543064.png	2026-05-07 07:30:48.078295+00
d4e66a8b-ec3c-438b-a0c4-8ae3c99a1fc4	6200nostand-png-1777838874783.png	6200nostand-png-1777838874783.png	/api/images/products/6200nostand-png-1777838874783.png	2026-05-07 07:30:48.078295+00
49c5a85a-32f0-4232-8b2e-19c1bdd8b15b	8500-2-png-1776887204493.png	8500-2-png-1776887204493.png	/api/images/products/8500-2-png-1776887204493.png	2026-05-07 07:30:48.078295+00
24f9828a-4b67-41c5-a09b-a294310227da	barcode-png-1776944902806.png	barcode-png-1776944902806.png	/api/images/products/barcode-png-1776944902806.png	2026-05-07 07:30:48.078295+00
41300608-c061-4b23-8e77-c085ffbd6f30	biometric-png-1777842077147.png	biometric-png-1777842077147.png	/api/images/products/biometric-png-1777842077147.png	2026-05-07 07:30:48.078295+00
635dbe93-9ebd-4be5-b4c2-cbb3cb55bb85	charging-png-1776886283491.png	charging-png-1776886283491.png	/api/images/products/charging-png-1776886283491.png	2026-05-07 07:30:48.078295+00
7288b9bc-0033-4752-8ee7-cd50f6fe26eb	dgs1024dfront-png-1776945184469.png	dgs1024dfront-png-1776945184469.png	/api/images/products/dgs1024dfront-png-1776945184469.png	2026-05-07 07:30:48.078295+00
95af75b7-f12b-42f7-9a9d-f108b60e89a8	fail.png	fail.png	/api/images/products/fail.png	2026-05-07 07:30:48.078295+00
44612e8a-d003-4361-bdd3-32ecc717a511	frame-15-10-png-1776883621376.png	frame-15-10-png-1776883621376.png	/api/images/products/frame-15-10-png-1776883621376.png	2026-05-07 07:30:48.078295+00
7b524fa0-c6d1-4a36-a1c0-025cbd8833c6	luxe8500-png-1776928779607.png	luxe8500-png-1776928779607.png	/api/images/products/luxe8500-png-1776928779607.png	2026-05-07 07:30:48.078295+00
4fd43f57-9ba6-4a4c-b5df-417f6ec19172	multybay-png-1776885460003.png	multybay-png-1776885460003.png	/api/images/products/multybay-png-1776885460003.png	2026-05-07 07:30:48.078295+00
e832c322-f4e1-4061-9560-3baea47c3907	pass.png	pass.png	/api/images/products/pass.png	2026-05-07 07:30:48.078295+00
494dc794-b013-409e-a151-0b64b6ee2b5a	polemount-png-1776969686256.png	polemount-png-1776969686256.png	/api/images/products/polemount-png-1776969686256.png	2026-05-07 07:30:48.078295+00
e459101b-c5bf-4325-a82f-0675f739e2b2	power-png-1776888114868.png	power-png-1776888114868.png	/api/images/products/power-png-1776888114868.png	2026-05-07 07:30:48.078295+00
d780e4ab-1b6b-4c89-8e9f-67ef7675887c	powerpack-png-1776885428839.png	powerpack-png-1776885428839.png	/api/images/products/powerpack-png-1776885428839.png	2026-05-07 07:30:48.078295+00
12f9c010-fbf9-4bb3-914b-e85623991148	powervar250-png-1776944393892.png	powervar250-png-1776944393892.png	/api/images/products/powervar250-png-1776944393892.png	2026-05-07 07:30:48.078295+00
43651a2b-3627-4cde-9300-0f5c22e947c9	powervar78-1-png-1776944613466.png	powervar78-1-png-1776944613466.png	/api/images/products/powervar78-1-png-1776944613466.png	2026-05-07 07:30:48.078295+00
bcb16883-a883-45aa-97d1-d55e239cf6aa	radial-arm-only-png-1776946928251.png	radial-arm-only-png-1776946928251.png	/api/images/products/radial-arm-only-png-1776946928251.png	2026-05-07 07:30:48.078295+00
93154d48-1cb1-46bb-9b4e-7d6a116a5132	rframetablet-png-1776883749995.png	rframetablet-png-1776883749995.png	/api/images/products/rframetablet-png-1776883749995.png	2026-05-07 07:30:48.078295+00
16ff4f24-4ed6-4831-a4c0-d2a2362d0c7d	rugframe-png-1776884130023.png	rugframe-png-1776884130023.png	/api/images/products/rugframe-png-1776884130023.png	2026-05-07 07:30:48.078295+00
37349698-14a1-44ab-83e9-81c8c7b542f1	servern4000-png-1776930069637.png	servern4000-png-1776930069637.png	/api/images/products/servern4000-png-1776930069637.png	2026-05-07 07:30:48.078295+00
08e0b631-5d60-448a-9ec6-041b198606e2	single-stationaxium-png-1776932521276.png	single-stationaxium-png-1776932521276.png	/api/images/products/single-stationaxium-png-1776932521276.png	2026-05-07 07:30:48.078295+00
a3c0b135-178b-4dda-8bdf-7a1b063eb104	singlebay-png-1776885449156.png	singlebay-png-1776885449156.png	/api/images/products/singlebay-png-1776885449156.png	2026-05-07 07:30:48.078295+00
04c976ac-dfaf-48b6-b5f0-162773cab1ec	straphand-png-1776885412746.png	straphand-png-1776885412746.png	/api/images/products/straphand-png-1776885412746.png	2026-05-07 07:30:48.078295+00
fdd6393f-ca8f-43b0-96ff-815ca1bcb5c4	wall-mount-png-1776969603634.png	wall-mount-png-1776969603634.png	/api/images/products/wall-mount-png-1776969603634.png	2026-05-07 07:30:48.078295+00
4725ec3c-ce4d-4c25-a6bf-7afca36e262c	watchguard330-png-1776970784769.png	watchguard330-png-1776970784769.png	/api/images/products/watchguard330-png-1776970784769.png	2026-05-07 07:30:48.078295+00
44435457-cc49-4d78-8a0c-8983316ed324	watchguard332-png-1776970898919.png	watchguard332-png-1776970898919.png	/api/images/products/watchguard332-png-1776970898919.png	2026-05-07 07:30:48.078295+00
cdfa0540-5adf-4e35-a1b5-80c2e0e1cace	watchguardt45-png-1776971070992.png	watchguardt45-png-1776971070992.png	/api/images/products/watchguardt45-png-1776971070992.png	2026-05-07 07:30:48.078295+00
60f1dbb5-ec91-4129-8b39-0bf2f11dea97	xl10displaynew-png-1776927534072.png	xl10displaynew-png-1776927534072.png	/api/images/products/xl10displaynew-png-1776927534072.png	2026-05-07 07:30:48.078295+00
cfad85d0-251d-4062-a6ca-cdb70b735c0e	advanced kitchen.png	advanced-kitchen.png	/api/images/products/advanced-kitchen.png	2026-05-07 08:41:10.557+00
e95311ff-debf-4b8a-916f-3920d6451599	basic kitchen.png	basic-kitchen.png	/api/images/products/basic-kitchen.png	2026-05-07 08:46:07.892285+00
4b8c8f6f-cd70-4947-9e59-31ec4c28d924	cx5-wall-mounted-1-png-1778145139991.png	cx5-wall-mounted-1-png-1778145139991.png	/api/images/products/cx5-wall-mounted-1-png-1778145139991.png	2026-05-07 09:12:29.021788+00
07d1cde1-dcfd-4b2a-b331-86fb64f7025f	xl10 plate (1).png	xl10-plate-1.png	/api/images/products/xl10-plate-1.png	2026-05-07 09:28:24.464189+00
a9c5208b-7f60-41ce-96d1-d267d5f72381	xl-stand-png-1778146375765.png	xl-stand-png-1778146375765.png	/api/images/products/xl-stand-png-1778146375765.png	2026-05-07 09:36:37.379717+00
268339e8-31cc-41aa-8a14-42955b9687da	6200 base.png	6200-base.png	/api/images/products/6200-base.png	2026-05-07 09:37:41.277434+00
\.


--
-- Data for Name: pit_catalog; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.pit_catalog (id, data, updated_at) FROM stdin;
catalog	{"categories": [{"id": "net-new", "name": "Net New", "lineItems": [{"id": "nn-001", "name": "Core Programming", "duration": 12}, {"id": "nn-002", "name": "Core Training", "duration": 8}, {"id": "nn-003", "name": "Project Management", "duration": 12}, {"id": "nn-004", "name": "Live Support", "duration": 8}]}, {"id": "refresh", "name": "Refresh", "lineItems": [{"id": "rf-001", "name": "Core Programming", "duration": 6}, {"id": "rf-002", "name": "Core Training", "duration": 4}, {"id": "rf-003", "name": "Project Management", "duration": 12}, {"id": "rf-004", "name": "Live Support", "duration": 8}]}, {"id": "site-copy", "name": "Site Copy", "lineItems": [{"id": "sc-001", "name": "Core Programming", "duration": 9}, {"id": "sc-002", "name": "Core Training", "duration": 8}, {"id": "sc-003", "name": "Project Management", "duration": 12}, {"id": "sc-004", "name": "Live Support", "duration": 8}]}, {"id": "heatmap", "name": "Heatmap and Cabling One Time", "lineItems": [{"id": "heat-001", "name": "Predictive Survey + Post Heatmap", "price": 2400}, {"id": "heat-002", "name": "Pre + Post Heatmap", "price": 4500}, {"id": "heat-003", "name": "Post Heatmap", "price": 1750}]}], "hourlyRate": 120}	2026-04-22 15:24:28.339+00
\.


--
-- Data for Name: product_catalog; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.product_catalog (id, data, updated_at) FROM stdin;
catalog	{"categories": [{"id": "core", "name": "Core", "items": [{"id": "co-001", "pci": 70, "hwmc": 0, "name": "Aloha Essentials 3.0 TS", "text": "License Count Must Match the Total Number of Devices (Terminals + Tablets)\\n\\nPackage Includes:\\n- One license of Aloha POS Software (TS or QS) that includes EDC, Quick Count, Aloha Connect (for use with  approved partners only), Customer Satisfaction Survey  and the 3rd Party Gift Card Interface\\n\\n- Aloha Takeout\\n- Aloha Command Center\\n- Aloha Configuration Center\\n- Aloha Pulse Real Time\\n- Help Desk", "type": "warning", "price": 130, "produration": 0, "traduration": 0, "instaduration": 0, "stageduration": 0}, {"id": "co-002", "pci": 70, "hwmc": 0, "name": "Aloha Essentials 3.0 QS", "text": "License Count Must Match the Total Number of Devices (Terminals + Tablets)\\n\\nPackage Includes:\\n- One license of Aloha POS Software (TS or QS) that includes EDC, Quick Count, Aloha Connect (for use with approved partners only), Customer Satisfaction Survey and the 3rd Party Gift Card Interface\\n\\n- Aloha Takeout\\n- Aloha Command Center\\n- Aloha Configuration Center\\n- Aloha Pulse Real Time\\n- Help Desk", "type": "warning", "price": 130, "produration": 0, "traduration": 0, "instaduration": 0, "stageduration": 0}]}, {"id": "terminals", "name": "Terminals", "items": [{"id": "tm-001", "pci": 30.69, "hwmc": 0, "name": "CX5 15 inch 4:3 Table top", "text": "- CX5, 15 inch 4:3, PCAP, Cel, 8GB, 120GB SSD, MSR, Serial I/O stand, WIN10-21, US\\n- Bixolon SRP-350plusV USB+Ethernet\\n- PowerVar 180VA Grandguard Pwr Cond", "type": "info", "image": "/products/cx5-png-1776801982742.png", "price": 88, "produration": 0, "traduration": 0, "instaduration": 1, "stageduration": 1}, {"id": "tm-002", "pci": 30.69, "hwmc": 0, "name": "CX5 15 inch 4:3 Wall Mount", "text": "- CX5, 15 inch 4:3, PCAP, Cel, 8GB, 120GB SSD, MSR, Serial I/O stand, WIN10-21, US\\n- Bixolon SRP-350plusV USB+Ethernet\\n- PowerVar 180VA Grandguard Pwr Cond\\n- Kit - CX wall mount bracket w/ integrated power supply storage", "type": "info", "image": "/api/images/products/cx5-wall-mounted-1-png-1778145139991.png", "price": 88, "produration": 0, "traduration": 0, "instaduration": 1, "stageduration": 1}]}, {"id": "server", "name": "BOH Server", "items": [{"id": "se-001", "pci": 40.64, "hwmc": 0, "name": "N4000 Server 16GB i5 240GB SSD", "text": "- ASUS 21.5 inch VP229Q with DP, HDMI, VGA\\n- PowerVar GTS 250VA UPM\\n- D-Link 24 Port\\n- N4000 16GB i5 240GB SSD W10 2021 LTSC US\\n- Mouse, Keyboard, Cable KIT", "type": "info", "image": "/api/images/products/servern4000-png-1776930069637.png", "price": 97, "produration": 0, "traduration": 0, "instaduration": 2, "stageduration": 2}]}, {"id": "serveradd", "name": "Additional Server and KWM", "items": [{"id": "se-002", "pci": 28.92, "hwmc": 0, "name": "N4000 Server 16GB i5 240GB SSD", "text": "- PowerVar GTS 250VA UPM\\n- OrderPay Dedicated Host Server N4000\\n- Cable KIT", "type": "info", "image": "/api/images/products/servern4000-png-1776930069637.png", "price": 77, "produration": 0, "traduration": 0, "instaduration": 2, "stageduration": 2}, {"id": "se-003", "pci": 4.25, "name": "2-Display Port USB KVM Switch", "text": "", "type": "info", "image": "/products/kvm2.png", "price": 11, "produration": 0, "traduration": 0, "instaduration": 0, "stageduration": 0}, {"id": "se-004", "pci": 5.58, "name": "4-Display Port USB KVM Switch", "image": "/products/kvm4.png", "price": 15, "produration": 0, "traduration": 0, "instaduration": 0, "stageduration": 0}]}, {"id": "tablet", "name": "Windows Tablet", "items": [{"id": "ta-001", "pci": 38.97, "hwmc": 0, "name": "8 Inch Tablet With SmartBack, Equinox 6200, Shoulder Strap, PowerPack (Rugged Frame)", "text": "The PinPad, Charging Station, and Power Supply are not Included in the Base Unit and Require Individual Selection | Heat Maps and Cabling Must be communicated", "type": "warning", "image": "/api/images/products/frame-15-10-png-1776883621376.png", "price": 78, "produration": 0, "traduration": 0, "instaduration": 1, "stageduration": 1}, {"id": "ta-002", "pci": 29.97, "hwmc": 0, "name": "8 Inch Tablet With MSR, PowerPack, Shoulder Strap (Rugged Frame)", "text": "Charging Station, and Power Supply are not Included in the Base Unit and Require Individual Selection | Heat Maps and Cabling Must be communicated", "type": "warning", "image": "/api/images/products/rugframe-png-1776884130023.png", "price": 68, "produration": 0, "traduration": 0, "instaduration": 1, "stageduration": 1}, {"id": "ta-003", "pci": 33.166, "hwmc": 0, "name": "8 Inch Tablet With MSR, PowerPack, Shoulder Strap (Scanner Frame)", "text": "Charging Station, and Power Supply are not Included in the Base Unit and Require Individual Selection | Heat Maps and Cabling Must be communicated", "type": "warning", "image": "/api/images/products/rframetablet-png-1776883749995.png", "price": 73, "produration": 0, "traduration": 0, "instaduration": 1, "stageduration": 1}, {"id": "ta-004", "pci": 0.44, "hwmc": 0, "name": "Hand Strap for Tablet", "text": "", "type": "info", "image": "/api/images/products/straphand-png-1776885412746.png", "price": 1, "produration": 0, "traduration": 0, "instaduration": 0, "stageduration": 0}, {"id": "ta-005", "pci": 4.527, "hwmc": 0, "name": "Tablet Extended Battery Pack", "text": "", "type": "info", "image": "/api/images/products/powerpack-png-1776885428839.png", "price": 8, "produration": 0, "traduration": 0, "instaduration": 0, "stageduration": 0}, {"id": "ta-006", "pci": 4.58, "hwmc": 0, "name": "Power Supply", "text": "", "type": "info", "image": "/api/images/products/power-png-1776888114868.png", "price": 11, "produration": 0, "traduration": 0, "instaduration": 0, "stageduration": 0}, {"id": "ta-007", "pci": 2.833, "hwmc": 0, "name": "Docking Bay Charger-Single Unit", "text": "", "type": "info", "image": "/api/images/products/singlebay-png-1776885449156.png", "price": 8, "produration": 0, "traduration": 0, "instaduration": 0, "stageduration": 0}, {"id": "ta-008", "pci": 10.44, "hwmc": 0, "name": "Docking Bay Charger-Multi up to 5 Units", "text": "", "type": "info", "image": "/api/images/products/multybay-png-1776885460003.png", "price": 37, "produration": 0, "traduration": 0, "instaduration": 0, "stageduration": 0}]}, {"id": "handheld", "name": "Hand-held", "items": [{"id": "ha-001", "pci": 15.5, "hwmc": 0, "name": "Axium Ex8000, Case with Clip (OrderPay) HW|SW", "text": "Charging Station is not Included in the Base Unit and Require Individual Selection | Heat maps and cabling must be communicated | Additional BOH Server Must be Sold", "type": "warning", "image": "/products/axiumclip-png-1776802047224.png", "price": 57, "produration": 2, "traduration": 2, "instaduration": 1, "stageduration": 1}, {"id": "ha-002", "pci": 16.25, "hwmc": 0, "name": "Axium Ex8000, Case with Strap (OrderPay) HW|SW", "text": "Charging Station is not Included in the Base Unit and Require Individual Selection | Heat maps and cabling must be communicated | Additional BOH Server Must be Sold", "type": "warning", "image": "/products/axiumstrap-png-1776802057822.png", "price": 57, "produration": 2, "traduration": 2, "instaduration": 1, "stageduration": 1}, {"id": "ha-003", "pci": 1.472, "hwmc": 0, "name": "Axium Docking Bay Charger-Single Unit", "text": "", "type": "info", "image": "/api/images/products/single-stationaxium-png-1776932521276.png", "price": 5, "produration": 0, "traduration": 0, "instaduration": 0, "stageduration": 0}, {"id": "ha-004", "pci": 7.44, "hwmc": 0, "name": "Axium Multi-Bay Docking Charging Station up to 5 Units", "text": "", "type": "info", "image": "/api/images/products/5bayaxium-png-1776932543064.png", "price": 20, "produration": 0, "traduration": 0, "instaduration": 0, "stageduration": 0}, {"id": "ha-005", "pci": 4, "hwmc": 0, "name": "Axium Additional License - TS Only", "text": "", "type": "info", "price": 20, "produration": 0, "traduration": 0, "instaduration": 0, "stageduration": 0}]}, {"id": "pinpads", "name": "Pin-Pads", "items": [{"id": "pi-001", "pci": 12.69, "hwmc": 0, "name": "Voyix Pay Equinox 6200m P-USB with Stand", "text": "", "type": "info", "image": "/products/6200.png", "price": 35, "produration": 0, "traduration": 0, "instaduration": 1, "stageduration": 1}, {"id": "pi-002", "pci": 12.69, "name": "WorldPay/Vantiv Equinox 6200m P-USB with Stand", "text": "", "type": "info", "image": "/api/images/products/6200.png", "price": 40, "produration": 0, "traduration": 0, "instaduration": 1, "stageduration": 1}, {"id": "pi-003", "pci": 12.22, "name": "Voyix Pay Equinox 6200m Mobile without Printer", "text": "Weighted Base and Mobile Charging Stand is not Included in the Base Unit and Require Individual Selection", "type": "warning", "image": "/products/6200m.png", "price": 35, "produration": 0, "traduration": 0, "instaduration": 1, "stageduration": 1}, {"id": "pi-004", "pci": 12.22, "name": "WorldPay/Vantiv Equinox 6200m Mobile without Printer", "text": "Weighted Base and Mobile Charging Stand is not Included in the Base Unit and Require Individual Selection", "type": "warning", "image": "/api/images/products/6200m.png", "price": 40, "produration": 0, "traduration": 0, "instaduration": 1, "stageduration": 1}, {"id": "pi-005", "pci": 13.777, "hwmc": 0, "name": "Voyix Pay Equinox 6200m P-USB CX5/CX7 POS Mount", "text": "", "type": "info", "image": "/api/images/products/8500-2-png-1776887204493.png", "price": 35, "produration": 0, "traduration": 0, "instaduration": 1, "stageduration": 1}, {"id": "pi-006", "pci": 13.78, "hwmc": 0, "name": "WorldPay/Vantiv Equinox 6200m P-USB CX5/CX7 POS Mount", "text": "", "type": "info", "image": "/api/images/products/8500-2-png-1776887204493.png", "price": 40, "produration": 0, "traduration": 0, "instaduration": 1, "stageduration": 1}, {"id": "pi-007", "pci": 1.08, "hwmc": 0, "name": "6200m Mobile Charging Stand", "text": "", "type": "info", "image": "/api/images/products/charging-png-1776886283491.png", "price": 2, "produration": 0, "traduration": 0, "instaduration": 0, "stageduration": 0}, {"id": "pi-008", "pci": 16.69, "hwmc": 0, "name": "Voyix Pay Equinox 8500i P-USB with Stand", "text": "Weighted Base is not Included in the Base Unit and Require Individual Selection", "type": "warning", "image": "/api/images/products/luxe8500-png-1776928779607.png", "price": 40, "produration": 0, "traduration": 0, "instaduration": 1, "stageduration": 1}, {"id": "pi-009", "pci": 16.69, "hwmc": 0, "name": "WorldPay/Vantiv Equinox 8500i P-USB with Stand", "text": "Weighted Base is not Included in the Base Unit and Require Individual Selection", "type": "warning", "image": "/api/images/products/luxe8500-png-1776928779607.png", "price": 45, "produration": 0, "traduration": 0, "instaduration": 1, "stageduration": 1}, {"id": "pi-010", "pci": 0.75, "hwmc": 0, "name": "Weighted Base with Rubber Pad", "text": "", "type": "info", "image": "/api/images/products/6200-base.png", "price": 1, "produration": 0, "traduration": 0, "instaduration": 0, "stageduration": 0}, {"id": "pi-011", "pci": 0.53, "hwmc": 0, "name": "Weighted Base with Adhesive Base", "text": "", "type": "info", "image": "/api/images/products/6200-base.png", "price": 1, "produration": 0, "traduration": 0, "instaduration": 0, "stageduration": 0}, {"id": "pi-012", "pci": 12.22, "hwmc": 0, "name": "Voyix Pay Equinox 6200m device (straight cable option)", "text": "", "type": "info", "image": "/api/images/products/6200nostand-png-1777838874783.png", "price": 40, "produration": 0, "traduration": 0, "instaduration": 0, "stageduration": 0}]}, {"id": "printers", "name": "Printers", "items": [{"id": "pr-001", "pci": 6.61, "name": "Bixolon SRP-S300 Serial Label Printer Thermal Printer", "text": "", "type": "info", "image": "/products/s300-png-1776802107899.png", "price": 15, "produration": 0, "traduration": 0, "instaduration": 1, "stageduration": 1}, {"id": "pr-002", "pci": 6.58, "name": "Bixolon SRP-S300 Ethernet Label Printer Thermal Printer", "text": "", "type": "info", "image": "/products/s300-png-1776802119971.png", "price": 16, "produration": 0, "traduration": 0, "instaduration": 1, "stageduration": 1}, {"id": "pr-003", "pci": 4.22, "name": "Bixolon SRP-350 Plus V USB+Ethernet+Serial Thermal Printer", "text": "", "type": "info", "image": "/products/srp350v-png-1776802130855.png", "price": 15, "produration": 0, "traduration": 0, "instaduration": 1, "stageduration": 1}, {"id": "pr-004", "pci": 4.78, "name": "Bixolon SRP-275 III Kitchen Impact Ethernet", "text": "To Ensure Stable Performance And Protect Against Power Surges An Additional 78VA Power Conditioner Is Required For All Kitchen Printer Installations", "type": "warning", "image": "/products/srp275iii-png-1776802139214.png", "price": 18, "produration": 0, "traduration": 0, "instaduration": 1, "stageduration": 1}, {"id": "pr-005", "pci": 4.92, "name": "Bixolon SRP-275 III Kitchen Impact Serial", "text": "To Ensure Stable Performance And Protect Against Power Surges An Additional 78VA Power Conditioner Is Required For All Kitchen Printer Installations", "type": "warning", "image": "/products/srp275iii-png-1776802149552.png", "price": 16, "produration": 0, "traduration": 0, "instaduration": 1, "stageduration": 1}]}, {"id": "displays", "name": "Displays", "items": [{"id": "dp-001", "pci": 5.44, "hwmc": 0, "name": "XL10 No-Touch Display Only With MSR", "text": "", "type": "info", "image": "/api/images/products/xl10displaynew-png-1776927534072.png", "price": 17, "produration": 0, "traduration": 0, "instaduration": 1, "stageduration": 1}, {"id": "dp-002", "pci": 8.25, "hwmc": 0, "name": "XL10 USB-C Touch Display Only With MSR", "text": "", "type": "info", "image": "/api/images/products/xl10displaynew-png-1776927534072.png", "price": 25, "produration": 0, "traduration": 0, "instaduration": 1, "stageduration": 1}, {"id": "dp-003", "pci": 0.5, "hwmc": 0, "name": "Mounting Bracket and Cable for CX5/CX7", "text": "", "type": "info", "image": "/api/images/products/xl10-plate-1.png", "price": 1, "produration": 0, "traduration": 0, "instaduration": 0, "stageduration": 0}, {"id": "dp-004", "pci": 0, "hwmc": 0, "name": "XL10 Table-Top Stand", "text": "", "type": "info", "image": "/api/images/products/xl-stand-png-1778146375765.png", "price": 3, "produration": 0, "traduration": 0, "instaduration": 0, "stageduration": 0}]}, {"id": "peripherals", "name": "Peripherals", "items": [{"id": "ps-001", "pci": 2.53, "name": "MS 16 Inch Cash Drawer", "text": "", "type": "info", "image": "/products/ms16-png-1776802093205.png", "price": 10, "produration": 0, "traduration": 0, "instaduration": 0, "stageduration": 0}, {"id": "ps-002", "pci": 5.72, "hwmc": 0, "name": "PowerVar 250VA Server BBU", "text": "", "type": "info", "image": "/api/images/products/powervar250-png-1776944393892.png", "price": 20, "produration": 0, "traduration": 0, "instaduration": 0, "stageduration": 0}, {"id": "ps-003", "pci": 2.03, "hwmc": 0, "name": "PowerVar 78VA Kitchen GG Power Conditioner", "text": "", "type": "info", "image": "/api/images/products/powervar78-1-png-1776944613466.png", "price": 10, "produration": 0, "traduration": 0, "instaduration": 0, "stageduration": 0}, {"id": "ps-004", "pci": 3.78, "hwmc": 0, "name": "DS9308 QR and Bar Code Scanner", "text": "", "type": "info", "image": "/api/images/products/barcode-png-1776944902806.png", "price": 16, "produration": 0, "traduration": 0, "instaduration": 0, "stageduration": 0}, {"id": "ps-005", "pci": 9.58, "hwmc": 0, "name": "24 Port Switch PoE", "text": "", "type": "info", "image": "/api/images/products/dgs1024dfront-png-1776945184469.png", "price": 25, "produration": 0, "traduration": 0, "instaduration": 0, "stageduration": 0}, {"id": "ps-006", "pci": 5.06, "hwmc": 0, "name": "Additional 24 Port Switch PoE", "text": "", "type": "info", "image": "/api/images/products/dgs1024dfront-png-1776945184469.png", "price": 15, "produration": 0, "traduration": 0, "instaduration": 0, "stageduration": 0}, {"id": "ps-007", "pci": 0.81, "hwmc": 0, "name": "Cash Drawer Till", "text": "", "type": "info", "image": "/products/ms16till-png-1776802012846.png", "price": 1, "produration": 0, "traduration": 0, "instaduration": 0, "stageduration": 0}, {"id": "ps-008", "pci": 1.36, "hwmc": 0, "name": "Biometric Reader - External USB", "text": "", "type": "info", "image": "/api/images/products/biometric-png-1777842077147.png", "price": 12, "produration": 0, "traduration": 0, "instaduration": 0, "stageduration": 0}]}, {"id": "expo", "name": "Advanced Kitchen", "items": [{"id": "exp-001", "pci": 32.11, "hwmc": 0, "name": "Advanced Expo Station HW+SW", "text": "- KT2200 21.5 inch Stainless Steel PCAP Touch Display\\n- PowerVar Conditioner 78VA UPM\\n- KC5 Win10 2021 Embedded 64bit 120GB\\n- Aloha Kitchen SW license - single license PID\\n- Quick Release Mount | Cable KIT", "type": "info", "image": "/api/images/products/advanced-kitchen.png", "price": 98, "produration": 6, "traduration": 2, "instaduration": 1, "stageduration": 1, "sitecopyproduration": 0, "sitecopytradiration": 0}, {"id": "exp-002", "pci": 4.03, "name": "Heavy Duty Radial Arm Kitchen Mount", "text": "", "type": "info", "image": "/api/images/products/radial-arm-only-png-1776946928251.png", "price": 10, "produration": 0, "traduration": 0, "instaduration": 0, "stageduration": 0}]}, {"id": "prep", "name": "Basic Kitchen", "items": [{"id": "prp-001", "pci": 25.14, "hwmc": 0, "name": "Basic Prep Station HW+SW", "text": "- ASUS 21.5 inch VP229Q with DP, HDMI, VGA\\n- PowerVar Conditioner 78VA UPM\\n- Bump Bar USB/Serial 16 Button\\n- KC5 Win10 2021 Embedded 64bit 120GB\\n- Aloha Kitchen SW license - single license PID\\n- Integration Brkt | Cable KIT", "type": "info", "image": "/api/images/products/basic-kitchen.png", "price": 91, "produration": 6, "traduration": 2, "instaduration": 1, "stageduration": 1, "sitecopyproduration": 0, "sitecopytradiration": 0}, {"id": "prp-002", "pci": 0.78, "name": "Wall Kitchen Mount Bracket", "text": "", "type": "info", "image": "/api/images/products/wall-mount-png-1776969603634.png", "price": 2, "produration": 0, "traduration": 0, "instaduration": 0, "stageduration": 0}, {"id": "prp-003", "pci": 3.14, "name": "Counter Pole Kitchen Mount", "text": "", "type": "info", "image": "/api/images/products/polemount-png-1776969686256.png", "price": 10, "produration": 0, "traduration": 0, "instaduration": 0, "stageduration": 0}]}, {"id": "nss", "name": "Network and Security", "items": [{"id": "net-001", "pci": 24.64, "hwmc": 0, "name": "Network Security", "text": "", "type": "info", "price": 90, "produration": 0, "traduration": 0, "instaduration": 0, "stageduration": 0}, {"id": "net-002", "pci": 35.44, "name": "Aloha Wi-Fi", "price": 100, "produration": 0, "traduration": 0, "instaduration": 0, "stageduration": 0}, {"id": "net-003", "pci": 10.81, "hwmc": 0, "name": "Indoor Wireless Access Point-330", "text": "", "type": "info", "image": "/api/images/products/watchguard330-png-1776970784769.png", "price": 30, "produration": 0, "traduration": 0, "instaduration": 0, "stageduration": 0}, {"id": "net-004", "pci": 24.75, "hwmc": 0, "name": "Outdoor Wireless Access Point-332", "text": "", "type": "info", "image": "/api/images/products/watchguard332-png-1776970898919.png", "price": 40, "produration": 0, "traduration": 0, "instaduration": 0, "stageduration": 0}, {"id": "net-005", "pci": 24.64, "hwmc": 0, "name": "Site Shield (Standalone)", "text": "", "type": "info", "image": "/api/images/products/watchguardt45-png-1776971070992.png", "price": 70, "produration": 0, "traduration": 0, "instaduration": 0, "stageduration": 0}, {"id": "net-006", "pci": 1.2, "name": "Threat Defender", "price": 12, "produration": 0, "traduration": 0, "instaduration": 0, "stageduration": 0}, {"id": "net-007", "pci": 0.9, "name": "NCR Patch Management", "price": 9, "produration": 0, "traduration": 0, "instaduration": 0, "stageduration": 0}, {"id": "net-008", "pci": 0.7, "name": "NCR Antivirus", "price": 7, "produration": 0, "traduration": 0, "instaduration": 0, "stageduration": 0}, {"id": "net-009", "pci": 2.5, "name": "PCI Compliance Services (ControlScan)", "price": 25, "produration": 0, "traduration": 0, "instaduration": 0, "stageduration": 0}, {"id": "net-010", "pci": 1.5, "name": "Internal Network Scanning", "price": 15, "produration": 0, "traduration": 0, "instaduration": 0, "stageduration": 0}, {"id": "net-011", "pci": 1.8, "name": "Log Management", "price": 18, "produration": 0, "traduration": 0, "instaduration": 0, "stageduration": 0}, {"id": "net-012", "pci": 7.5, "name": "Broadband Failover", "price": 75, "produration": 0, "traduration": 0, "instaduration": 0, "stageduration": 0}]}, {"id": "softwareadd", "name": "Software Add", "items": [{"id": "sa-001", "pci": 5, "hwmc": 0, "name": "Consumer Marketing-Core", "text": "One Per Site", "type": "info", "price": 50, "produration": 2, "traduration": 2, "instaduration": 0, "stageduration": 0}, {"id": "sa-002", "pci": 1.5, "hwmc": 0, "name": "Aloha Insight", "text": "One Per Site and more", "type": "info", "price": 15, "produration": 1, "traduration": 1, "instaduration": 0, "stageduration": 0}, {"id": "sa-003", "pci": 3, "hwmc": 0, "name": "Aloha Console", "text": "One Per Site", "type": "info", "price": 10, "produration": 1, "traduration": 1, "instaduration": 0, "stageduration": 0}, {"id": "sa-004", "pci": 4, "hwmc": 0, "name": "Aloha Stored Value", "text": "One Per Site", "type": "info", "price": 15, "produration": 0, "traduration": 0, "instaduration": 0, "stageduration": 0}, {"id": "sa-005", "pci": 21, "hwmc": 0, "name": "Aloha API", "text": "One Per Site", "type": "info", "price": 50, "produration": 2, "traduration": 0, "instaduration": 0, "stageduration": 0}, {"id": "sa-006", "pci": 12.5, "hwmc": 0, "name": "Actionable Insights-Restaurant Guard", "text": "One Per Site", "type": "info", "price": 125, "produration": 0, "traduration": 0, "instaduration": 0, "stageduration": 0}, {"id": "sa-007", "pci": 7.5, "hwmc": 0, "name": "Aloha Delivery", "text": "One Per Site", "type": "info", "price": 30, "produration": 2, "traduration": 0, "instaduration": 0, "stageduration": 0}, {"id": "sa-008", "pci": 2, "hwmc": 0, "name": "Aloha Stored Value-Webstore", "text": "One Per Site", "type": "info", "price": 20, "produration": 0, "traduration": 0, "instaduration": 0, "stageduration": 0}, {"id": "sa-009", "pci": 35, "hwmc": 0, "name": "Enterprise Back Office", "text": "One Per Site", "type": "info", "price": 140, "produration": 0, "traduration": 0, "instaduration": 0, "stageduration": 0}, {"id": "sa-011", "pci": 4, "name": "Axium License-TS", "price": 20, "produration": 0, "traduration": 0, "instaduration": 0, "stageduration": 0}, {"id": "sa-012", "pci": 6, "name": "Mobile SW License-TS", "price": 30, "produration": 0, "traduration": 0, "instaduration": 0, "stageduration": 0}, {"id": "sa-013", "pci": 6, "name": "Mobile SW License-QS", "price": 30, "produration": 0, "traduration": 0, "instaduration": 0, "stageduration": 0}, {"id": "sa-014", "pci": 10, "hwmc": 0, "name": "PMS Interface", "text": "One Per Site", "type": "info", "price": 40, "produration": 0, "traduration": 0, "instaduration": 0, "stageduration": 0}, {"id": "sa-015", "pci": 0, "hwmc": 0, "name": "Aloha Mobile Engage", "text": "One Per Site", "type": "info", "price": 0, "produration": 0, "traduration": 0, "instaduration": 0, "stageduration": 0}, {"id": "sa-016", "pci": 0, "name": "Aloha Connect EIT", "price": 0, "produration": 0, "traduration": 0, "instaduration": 0, "stageduration": 0}, {"id": "sa-017", "pci": 6.25, "name": "Kitchen Operations SW", "price": 25, "produration": 0, "traduration": 0, "instaduration": 0, "stageduration": 0}, {"id": "sa-018", "pci": 15, "hwmc": 0, "name": "Aloha Smart Manager - Starter", "text": "One Per Site", "type": "info", "price": 99, "produration": 0, "traduration": 0, "instaduration": 0, "stageduration": 0}, {"id": "sa-019", "pci": 0, "name": "Biometric License", "price": 0, "produration": 0, "traduration": 0, "instaduration": 0, "stageduration": 0}, {"id": "sa-020", "pci": 0, "name": "SW ATO with Non-NCR Radiant HW", "price": 0, "produration": 0, "traduration": 0, "instaduration": 0, "stageduration": 0}, {"id": "sa-021", "pci": 0, "hwmc": 0, "name": "3rd Party Kitchen Integration | VIDEO MX", "text": "One Per Site", "type": "info", "price": 0, "produration": 0, "traduration": 0, "instaduration": 0, "stageduration": 0}, {"id": "sa-022", "pci": 0, "hwmc": 0, "name": "SBONet", "text": "One Per Site", "type": "info", "price": 159, "produration": 0, "traduration": 0, "instaduration": 0, "stageduration": 0}]}, {"id": "olo", "name": "Online Ordering package", "items": [{"id": "olo-001", "pci": 8.5, "name": "Online Ordering Fixed 500", "price": 85, "produration": 0, "traduration": 0, "instaduration": 0, "stageduration": 0}, {"id": "olo-002", "pci": 15, "name": "Online Ordering Fixed 1000", "price": 150, "produration": 0, "traduration": 0, "instaduration": 0, "stageduration": 0}, {"id": "olo-003", "pci": 8.5, "name": "Online Ordering (NCR Pay Variable)", "price": 0, "produration": 0, "traduration": 0, "instaduration": 0, "stageduration": 0}]}, {"id": "aloha20", "name": "Aloha Essential 2.0 HW", "items": [{"id": "boh-001", "pci": 0, "name": "BOH Server S600", "price": 30.95, "produration": 0, "traduration": 0, "instaduration": 0, "stageduration": 0}, {"id": "fox-001", "pci": 0, "name": "FOH CX3 Terminal", "price": 29.74, "produration": 0, "traduration": 0, "instaduration": 0, "stageduration": 0}, {"id": "fox-002", "pci": 0, "name": "FOH CX3 Terminal APA 2x20 ", "price": 32.4, "produration": 0, "traduration": 0, "instaduration": 0, "stageduration": 0}, {"id": "km-001", "pci": 0, "name": "Short Pole Ceiling Kitchen Mount", "price": 14, "produration": 0, "traduration": 0, "instaduration": 0, "stageduration": 0}, {"id": "boh-002", "pci": 0, "name": "N4000 Wall and Rack Mount", "price": 5, "produration": 0, "traduration": 0, "instaduration": 0, "stageduration": 0}, {"id": "xl-001", "pci": 0, "name": "XL10 Touch USB-C Display with MSR", "price": 13.75, "produration": 0, "traduration": 0, "instaduration": 0, "stageduration": 0}, {"id": "pay-001", "pci": 0, "name": "Voyix Pay Equinox 6200m Mobile with Printer", "price": 19.25, "produration": 0, "traduration": 0, "instaduration": 0, "stageduration": 0}, {"id": "pay-002", "pci": 0, "name": "6200m Mobile Charging Stand", "price": 2, "produration": 0, "traduration": 0, "instaduration": 0, "stageduration": 0}]}], "tieredAdditionalPrice": 30}	2026-05-07 09:38:12.647+00
\.


--
-- Data for Name: quotes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.quotes (id, user_id, data, quote_number, company_name, customer_name, created_at, updated_at, updated_by_user_id, updated_by_name, pass_status) FROM stdin;
7vppr6so	6cb81f26-5122-4116-9459-075b163a1568	{"meta": {"id": "7vppr6so", "tax": 0, "notes": "Customer is expecting to be informed about delivery date 24h before the actual date.", "ncrPay": true, "pitType": "refresh", "discount": 0, "salesRep": "Erica Madison", "createdAt": "2026-05-07", "oppNumber": "7768776", "updatedAt": "2026-05-07", "basisPoint": "30", "passStatus": "pass", "validUntil": "2026-06-06", "companyName": "Hosareno Piyzza Bar & Grill", "creatorName": "Nenad Jelic", "quoteNumber": "Q-334567", "customerName": "Marta Swing", "yesNoToggles": {"online-ordering-yn": true, "connected-payments-yn": true}, "customerEmail": "m.swing@gmail.com", "numberOfSites": "2", "annualStoreRevenue": "2400000", "paymentsSpecialist": "Carla Paton", "averageTicketAmount": "24", "existingHeadlineRate": "0.06", "aeCurrentMonthlySpend": "1245", "aeCurrentVoyixPaySpend": "789", "requestedUpfrontAmount": "0", "voyixPayTransactionFee": "0.06", "existingInterchangeRate": "30", "requestedSubscriptionAmount": "950"}, "groups": [{"id": "teg6ae2n", "isOpen": true, "lineItems": [{"id": "j646jrf8", "note": "", "quantity": 4, "productId": "tm-001", "unitPrice": 88, "productName": "CX5 15 inch 4:3 Table top"}], "categoryId": "terminals", "categoryName": "Terminals"}, {"id": "l0izegaa", "isOpen": true, "lineItems": [{"id": "slly5l5p", "note": "", "quantity": 1, "productId": "se-001", "unitPrice": 97, "productName": "N4000 Server 16GB i5 240GB SSD"}], "categoryId": "server", "categoryName": "BOH Server"}, {"id": "57wqvug4", "isOpen": true, "lineItems": [{"id": "a79f7xzb", "note": "", "quantity": 4, "productId": "pi-001", "unitPrice": 35, "productName": "Voyix Pay Equinox 6200m P-USB with Stand"}, {"id": "pijvvufo", "note": "", "quantity": 4, "productId": "pi-010", "unitPrice": 1, "productName": "Weighted Base with Rubber Pad"}], "categoryId": "pinpads", "categoryName": "Pin-Pads"}, {"id": "jy10e3br", "isOpen": true, "lineItems": [{"id": "9sa7qphf", "note": "", "quantity": 4, "productId": "co-001", "unitPrice": 130, "productName": "Aloha Essentials 3.0 TS"}], "categoryId": "core", "categoryName": "Core"}, {"id": "8qte4h9a", "isOpen": true, "lineItems": [{"id": "di9hcqt5", "note": "", "quantity": 1, "productId": "exp-001", "unitPrice": 98, "productName": "Advanced Expo Station HW+SW"}, {"id": "18ljcyvg", "note": "", "quantity": 1, "productId": "exp-002", "unitPrice": 10, "productName": "Heavy Duty Radial Arm Kitchen Mount"}], "categoryId": "expo", "categoryName": "Advanced Kitchen"}, {"id": "gjtjh4go", "isOpen": true, "lineItems": [{"id": "cxjfoitf", "note": "", "quantity": 4, "productId": "prp-001", "unitPrice": 91, "productName": "Basic Prep Station HW+SW"}, {"id": "8z9d6xfs", "note": "", "quantity": 4, "productId": "prp-002", "unitPrice": 2, "productName": "Wall Kitchen Mount Bracket"}], "categoryId": "prep", "categoryName": "Basic Kitchen"}, {"id": "60zw8nho", "isOpen": true, "lineItems": [{"id": "w6pr02g6", "note": "", "quantity": 1, "productId": "dp-003", "unitPrice": 1, "productName": "Mounting Bracket and Cable for CX5/CX7"}, {"id": "iiq40j4n", "note": "", "quantity": 1, "productId": "dp-001", "unitPrice": 17, "productName": "XL10 No-Touch Display Only With MSR"}, {"id": "k0cikbxl", "note": "", "quantity": 1, "productId": "dp-004", "unitPrice": 3, "productName": "XL10 Table-Top Stand"}], "categoryId": "displays", "categoryName": "Displays"}]}	Q-334567	Hosareno Piyzza Bar & Grill	Marta Swing	2026-05-07 00:00:00+00	2026-05-07 00:00:00+00	\N	Nenad Jelic	pass
\.


--
-- Data for Name: release_notifications; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.release_notifications (id, subject, message, recipient_emails, sent_at, sent_by, created_at) FROM stdin;
5c88f6e4-1c70-437c-b648-755183263350	New Release 6.1	Hi, Team\n\nRefresh your browser to make sure you are viewing the latest version ( 6.1 ). \n\nAll The Best.	["kriptoshonecom@gmail.com"]	2026-05-04 10:22:19.773368+00	admin	2026-05-04 10:22:19.330248+00
\.


--
-- Data for Name: sessions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.sessions (id, user_id, session_token, ip_address, user_agent, is_active, created_at, last_active_at, expires_at) FROM stdin;
f580eb3d-8650-489a-9e01-145ca769c8dd	6cb81f26-5122-4116-9459-075b163a1568	53d09bc5-0880-4e87-8140-c9f784a107b9	109.245.146.50	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	t	2026-05-07 07:17:35.566491+00	2026-05-07 08:43:32.243+00	2026-05-14 07:17:35.561+00
\.


--
-- Data for Name: status_pass_config; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.status_pass_config (id, data, updated_at) FROM stdin;
default	{"_version": "3.1", "categories": [{"id": "voyix-pay-yes", "name": "Voyix Pay Yes", "models": [{"id": "smb", "name": "SMB", "tiers": [{"txnRate": 0.05, "txnCount": 20, "lowVolume": 0, "highVolume": 2500}, {"txnRate": 0.048, "txnCount": 0, "lowVolume": 2501, "highVolume": 5000}, {"txnRate": 0.046, "txnCount": 0, "lowVolume": 5001, "highVolume": 7500}, {"txnRate": 0.044, "txnCount": 0, "lowVolume": 7501, "highVolume": 10000}, {"txnRate": 0.042, "txnCount": 0, "lowVolume": 10001, "highVolume": 15000}, {"txnRate": 0.04, "txnCount": 0, "lowVolume": 15001, "highVolume": 20000}, {"txnRate": 0.038, "txnCount": 0, "lowVolume": 20001, "highVolume": 25000}, {"txnRate": 0.036, "txnCount": 0, "lowVolume": 25001, "highVolume": 35000}, {"txnRate": 0.035, "txnCount": 0, "lowVolume": 35001, "highVolume": 50000}, {"txnRate": 0.034, "txnCount": 0, "lowVolume": 50001, "highVolume": 65000}, {"txnRate": 0.033, "txnCount": 0, "lowVolume": 65001, "highVolume": 85000}, {"txnRate": 0.032, "txnCount": 0, "lowVolume": 85001, "highVolume": 105000}, {"txnRate": 0.03, "txnCount": 0, "lowVolume": 105001, "highVolume": 105001}], "description": "Less than 10 sites"}, {"id": "mid-market", "name": "Mid-Market", "tiers": [{"txnRate": 0.04, "txnCount": 20, "lowVolume": 0, "highVolume": 20000}, {"txnRate": 0.038, "txnCount": 0, "lowVolume": 20001, "highVolume": 30000}, {"txnRate": 0.036, "txnCount": 0, "lowVolume": 30001, "highVolume": 40000}, {"txnRate": 0.035, "txnCount": 0, "lowVolume": 40001, "highVolume": 50000}, {"txnRate": 0.0325, "txnCount": 0, "lowVolume": 50001, "highVolume": 75000}, {"txnRate": 0.03, "txnCount": 0, "lowVolume": 75001, "highVolume": 100000}, {"txnRate": 0.0285, "txnCount": 0, "lowVolume": 100001, "highVolume": 125000}, {"txnRate": 0.027, "txnCount": 0, "lowVolume": 125001, "highVolume": 150000}, {"txnRate": 0.0255, "txnCount": 0, "lowVolume": 150001, "highVolume": 200000}, {"txnRate": 0.024, "txnCount": 0, "lowVolume": 200001, "highVolume": 250000}, {"txnRate": 0.0225, "txnCount": 0, "lowVolume": 250001, "highVolume": 300000}, {"txnRate": 0.0215, "txnCount": 0, "lowVolume": 300001, "highVolume": 400000}, {"txnRate": 0.02, "txnCount": 0, "lowVolume": 400001, "highVolume": 400001}], "description": "10 to 50 sites"}, {"id": "enterprise", "name": "Enterprise", "tiers": [{"txnRate": 0.0285, "txnCount": 20, "lowVolume": 0, "highVolume": 125000}, {"txnRate": 0.026, "txnCount": 0, "lowVolume": 125001, "highVolume": 175000}, {"txnRate": 0.025, "txnCount": 0, "lowVolume": 175001, "highVolume": 225000}, {"txnRate": 0.0225, "txnCount": 0, "lowVolume": 225001, "highVolume": 300000}, {"txnRate": 0.02, "txnCount": 0, "lowVolume": 300001, "highVolume": 500000}, {"txnRate": 0.018, "txnCount": 0, "lowVolume": 500001, "highVolume": 750000}, {"txnRate": 0.016, "txnCount": 0, "lowVolume": 750001, "highVolume": 1000000}, {"txnRate": 0.014, "txnCount": 0, "lowVolume": 1000001, "highVolume": 2000000}, {"txnRate": 0.012, "txnCount": 0, "lowVolume": 2000001, "highVolume": 5000000}, {"txnRate": 0.01, "txnCount": 0, "lowVolume": 5000001, "highVolume": 10000000}, {"txnRate": 0.008, "txnCount": 0, "lowVolume": 10000001, "highVolume": 15000000}, {"txnRate": 0.007, "txnCount": 0, "lowVolume": 15000001, "highVolume": 25000000}, {"txnRate": 0.006, "txnCount": 0, "lowVolume": 25000001, "highVolume": 25000001}], "description": "50+ sites"}]}, {"id": "voyix-pay-no", "name": "Voyix Pay No", "models": [{"id": "smb", "name": "SMB", "tiers": [{"txnRate": 0.075, "txnCount": 20, "lowVolume": 0, "highVolume": 2500}, {"txnRate": 0.073, "txnCount": 0, "lowVolume": 2501, "highVolume": 5000}, {"txnRate": 0.071, "txnCount": 0, "lowVolume": 5001, "highVolume": 7500}, {"txnRate": 0.069, "txnCount": 0, "lowVolume": 7501, "highVolume": 10000}, {"txnRate": 0.067, "txnCount": 0, "lowVolume": 10001, "highVolume": 15000}, {"txnRate": 0.0625, "txnCount": 0, "lowVolume": 15001, "highVolume": 20000}, {"txnRate": 0.0605, "txnCount": 0, "lowVolume": 20001, "highVolume": 25000}, {"txnRate": 0.0585, "txnCount": 0, "lowVolume": 25001, "highVolume": 35000}, {"txnRate": 0.0575, "txnCount": 0, "lowVolume": 35001, "highVolume": 50000}, {"txnRate": 0.0565, "txnCount": 0, "lowVolume": 50001, "highVolume": 65000}, {"txnRate": 0.053, "txnCount": 0, "lowVolume": 65001, "highVolume": 85000}, {"txnRate": 0.052, "txnCount": 0, "lowVolume": 85001, "highVolume": 105000}, {"txnRate": 0.05, "txnCount": 0, "lowVolume": 105001, "highVolume": 105001}], "description": "Less than 10 sites"}, {"id": "mid-market", "name": "Mid-Market", "tiers": [{"txnRate": 0.0625, "txnCount": 20, "lowVolume": 0, "highVolume": 20000}, {"txnRate": 0.0605, "txnCount": 0, "lowVolume": 20001, "highVolume": 30000}, {"txnRate": 0.0585, "txnCount": 0, "lowVolume": 30001, "highVolume": 40000}, {"txnRate": 0.0575, "txnCount": 0, "lowVolume": 40001, "highVolume": 50000}, {"txnRate": 0.055, "txnCount": 0, "lowVolume": 50001, "highVolume": 75000}, {"txnRate": 0.05, "txnCount": 0, "lowVolume": 75001, "highVolume": 100000}, {"txnRate": 0.0485, "txnCount": 0, "lowVolume": 100001, "highVolume": 125000}, {"txnRate": 0.047, "txnCount": 0, "lowVolume": 125001, "highVolume": 150000}, {"txnRate": 0.0455, "txnCount": 0, "lowVolume": 150001, "highVolume": 200000}, {"txnRate": 0.044, "txnCount": 0, "lowVolume": 200001, "highVolume": 250000}, {"txnRate": 0.0375, "txnCount": 0, "lowVolume": 250001, "highVolume": 300000}, {"txnRate": 0.0365, "txnCount": 0, "lowVolume": 300001, "highVolume": 400000}, {"txnRate": 0.035, "txnCount": 0, "lowVolume": 400001, "highVolume": 400001}], "description": "10 to 50 sites"}, {"id": "enterprise", "name": "Enterprise", "tiers": [{"txnRate": 0.0485, "txnCount": 20, "lowVolume": 0, "highVolume": 125000}, {"txnRate": 0.046, "txnCount": 0, "lowVolume": 125001, "highVolume": 175000}, {"txnRate": 0.04, "txnCount": 0, "lowVolume": 175001, "highVolume": 225000}, {"txnRate": 0.0375, "txnCount": 0, "lowVolume": 225001, "highVolume": 300000}, {"txnRate": 0.03, "txnCount": 0, "lowVolume": 300001, "highVolume": 500000}, {"txnRate": 0.028, "txnCount": 0, "lowVolume": 500001, "highVolume": 750000}, {"txnRate": 0.021, "txnCount": 0, "lowVolume": 750001, "highVolume": 1000000}, {"txnRate": 0.019, "txnCount": 0, "lowVolume": 1000001, "highVolume": 2000000}, {"txnRate": 0.012, "txnCount": 0, "lowVolume": 2000001, "highVolume": 5000000}, {"txnRate": 0.01, "txnCount": 0, "lowVolume": 5000001, "highVolume": 10000000}, {"txnRate": 0.008, "txnCount": 0, "lowVolume": 10000001, "highVolume": 15000000}, {"txnRate": 0.007, "txnCount": 0, "lowVolume": 15000001, "highVolume": 25000000}, {"txnRate": 0.006, "txnCount": 0, "lowVolume": 25000001, "highVolume": 25000001}], "description": "50+ sites"}]}], "paymentCosts": 3, "processingCost": 0.015}	2026-04-26 09:46:49.176+00
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, email, password_hash, full_name, created_at, role) FROM stdin;
6c8440cd-2ba0-48a6-bc8b-004895b75ab4	totalrev_1777203766494@example.com	$2b$10$wnEw6lePQtGocLRRYgxQlOFZUr7KJPz4fXlZPfKpMMkvJ0EIPNMn.	Admin Test	2026-04-26 11:43:25.232259+00	user
1a9002be-833a-4776-903a-07b0a762c75b	shonecom@gmail.com	$2b$10$TdGYipNZpZt8iSghx3VmbOVNyl2pL0PsemlRyB7f9G0JQS/.l3NCK	Nenad Jelic	2026-04-21 10:44:57.043603+00	admin
6cb81f26-5122-4116-9459-075b163a1568	nenad.jelic@ncrvoyix.com	$2b$10$ut3OXMcl02vWZ10qSgToB.tCWbRc53CCrusXIcaRAMSacIoVl8Bai	Nenad Jelic	2026-04-21 15:47:28.791854+00	admin
3d9124ae-eead-4fa0-819f-e56a9ae57ed2	testadmin_1777154806482@example.com	$2b$10$7.a0.2G/.biaJqbt3MVll.6VGFvKK5jBjfMuV8niUx098VD3Hfilq	Test Admin	2026-04-25 22:07:17.377377+00	admin
d05578ef-8609-44f3-86a8-10775640247b	verify_1777155922466@example.com	$2b$10$ETI772kag8Zu/W7CbWGDz.lbNp3wd.8e6KBGwiLHjqi61BEg4TmMK	Test Admin	2026-04-25 22:25:57.769115+00	admin
6e7f776f-1318-44b0-a51d-d319a3dd0d97	sptest_1777156372936@example.com	$2b$10$bDPpeiW6yDo7RdlVW1TQYOPczJFEdxFXnyPh9J0YAdf.CRroXf88S	Admin Test	2026-04-25 22:33:20.185544+00	admin
18bbfc2b-b2e6-4f34-b6d8-6b2bef350299	spflow_1777157140504@example.com	$2b$10$tk6WSuB/hrBQNNIrXK5dfeulEh.9SEdGiJ7OGd52BLZ1yMjpa.LlG	Admin Test	2026-04-25 22:46:25.520806+00	admin
1a6f3db2-0b6a-4047-90f1-cd9bc2fbe3cf	brtest_1777159240406@example.com	$2b$10$GI9wbl2hBvOmvwbJSYfmcuiZ9Oq9et1onLmawMKafzFnGiYT9k2TG	Admin Test	2026-04-25 23:21:24.369687+00	admin
6eeb2348-4b8c-467c-98b2-0b5ece398087	brtest2_1777160421751@example.com	$2b$10$W6QfNB5DEdD29GM2fq/kq.KeTm7a5u6jGFu0BL.Ji5we9urj/l9/S	Admin Test	2026-04-25 23:41:02.577705+00	admin
343b2286-4ccd-4a0c-bbde-e923ea88eb04	qtest_1777184178140@example.com	$2b$10$BWPKNmF6z9vIJLCeDNEUluqqmNrtCSSVIhZg8T/vYzTa3CUeyyyYG	QTest User	2026-04-26 06:17:02.941323+00	admin
752b9adb-4051-4d0a-b28c-ac940744de82	qtest2_1777184301144@example.com	$2b$10$663zM0VEA7cTLaMHiiiUWecwCJ0cpmSI2MAgYytTf1jG.cFx2gOB2	QTest User	2026-04-26 06:19:08.719399+00	admin
789de819-266f-4f66-9593-9a1e65ff3144	libtest_1777186604059@example.com	$2b$10$8yyveGv0wYfPy0zF5VAXWeGXRvlqgBRfFqWdVzgOabSJ7jmbIgaQ.	Lib Test	2026-04-26 06:57:20.620285+00	admin
2c9c0673-1deb-4071-b9df-9b2a7616797b	styletest_1777187535643@example.com	$2b$10$sa28OJRBeF3vHOirAhWxN.dTOMAYIG7iGmcQynxPm3uv1lecV/tOy	Style Test	2026-04-26 07:12:47.467643+00	admin
b6e9af6a-0972-4200-baef-f28482eb104c	sptest_1777195918796@example.com	$2b$10$7oerlIR5VvNTuDAkLsbTF.RqrUNikn0xCNULUD4Lmrs5Qr33Qr7jm	Jane Smith	2026-04-26 09:32:44.776183+00	admin
7b68c5ad-6f6c-4f56-9ded-3064a64e3b7a	spglobal_1777196726948@example.com	$2b$10$BWqVJP78MwwjlBBU.tzjfeeaBflGBTUC9BDlaowwQA9pCQSF5uz46	Sp Global	2026-04-26 09:45:54.794069+00	admin
1a98dd92-4128-4bf7-9578-70580b5a8794	annualtxn_1777199114582@example.com	$2b$10$DbkJ4BDgGy.TUZbKFwCKMuglCixyAOJnvXs5/TnkMCu5snX3li1Gq	Annual TXN Admin	2026-04-26 10:25:54.225155+00	admin
\.


--
-- Data for Name: verification_codes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.verification_codes (id, user_id, code, type, expires_at, used, created_at) FROM stdin;
54a3cc35-b10a-4f2b-8ae3-06a63d4756ee	1a9002be-833a-4776-903a-07b0a762c75b	FAK75FOE	register	2026-04-21 10:54:57.077+00	f	2026-04-21 10:44:57.078136+00
\.


--
-- Name: alert_configs alert_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alert_configs
    ADD CONSTRAINT alert_configs_pkey PRIMARY KEY (id);


--
-- Name: app_settings app_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_settings
    ADD CONSTRAINT app_settings_pkey PRIMARY KEY (key);


--
-- Name: login_events login_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.login_events
    ADD CONSTRAINT login_events_pkey PRIMARY KEY (id);


--
-- Name: media_files media_files_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_files
    ADD CONSTRAINT media_files_pkey PRIMARY KEY (id);


--
-- Name: media_files media_files_slug_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_files
    ADD CONSTRAINT media_files_slug_unique UNIQUE (slug);


--
-- Name: pit_catalog pit_catalog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pit_catalog
    ADD CONSTRAINT pit_catalog_pkey PRIMARY KEY (id);


--
-- Name: product_catalog product_catalog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_catalog
    ADD CONSTRAINT product_catalog_pkey PRIMARY KEY (id);


--
-- Name: quotes quotes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT quotes_pkey PRIMARY KEY (id);


--
-- Name: release_notifications release_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.release_notifications
    ADD CONSTRAINT release_notifications_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_session_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_session_token_key UNIQUE (session_token);


--
-- Name: status_pass_config status_pass_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.status_pass_config
    ADD CONSTRAINT status_pass_config_pkey PRIMARY KEY (id);


--
-- Name: users users_email_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_unique UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: verification_codes verification_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_codes
    ADD CONSTRAINT verification_codes_pkey PRIMARY KEY (id);


--
-- Name: quotes quotes_updated_by_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT quotes_updated_by_user_id_users_id_fk FOREIGN KEY (updated_by_user_id) REFERENCES public.users(id);


--
-- Name: quotes quotes_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT quotes_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: verification_codes verification_codes_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_codes
    ADD CONSTRAINT verification_codes_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict 75Nu67gGov4XEqVDfngpiyOklsHBNBH2n0dvNkPxrCHrhukizN3AqI3WTbAYjdR

