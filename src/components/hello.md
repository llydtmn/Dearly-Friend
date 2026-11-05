-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.profiles (
  id uuid NOT NULL,
  email text NOT NULL UNIQUE,
  name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  avatar_path text,
  default_signature text,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL,
  sender_email text NOT NULL,
  recipient_email text NOT NULL,
  greeting text NOT NULL,
  content text NOT NULL,
  signature text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  attachments ARRAY NOT NULL DEFAULT '{}'::text[],
  CONSTRAINT messages_pkey PRIMARY KEY (id),
  CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.authorized_emails (
  email text NOT NULL,
  added_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT authorized_emails_pkey PRIMARY KEY (email)
);
CREATE TABLE public.keepsakes (
  user_id uuid NOT NULL DEFAULT auth.uid(),
  message_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT keepsakes_pkey PRIMARY KEY (user_id, message_id),
  CONSTRAINT keepsakes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT keepsakes_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id)
);
CREATE TABLE public.scheduled_letters (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL DEFAULT auth.uid(),
  sender_email text NOT NULL,
  recipient_email text NOT NULL,
  greeting text,
  content text NOT NULL,
  signature text,
  attachments ARRAY NOT NULL DEFAULT '{}'::text[],
  occasion text,
  deliver_at timestamp with time zone NOT NULL,
  repeat_yearly boolean NOT NULL DEFAULT false,
  delivered_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT scheduled_letters_pkey PRIMARY KEY (id),
  CONSTRAINT scheduled_letters_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES auth.users(id)
);
CREATE TABLE public.email_blocks (
  recipient_email text NOT NULL,
  sender_email text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT email_blocks_pkey PRIMARY KEY (recipient_email, sender_email)
);