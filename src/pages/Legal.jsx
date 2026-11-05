import { useEffect } from 'react';

const CONTACT = import.meta.env.VITE_CONTACT_EMAIL;
const UPDATED = 'November 5, 2026';

const H2 = ({ id, children }) => (
  <h2 id={id} className="font-handwriting text-3xl mt-10 mb-3 scroll-mt-6">{children}</h2>
);
const H3 = ({ children }) => <h3 className="font-semibold mt-5 mb-1">{children}</h3>;
const P = ({ children }) => <p className="text-sm leading-relaxed text-ink/85 mb-2">{children}</p>;
const UL = ({ children }) => <ul className="list-disc pl-5 space-y-1 text-sm leading-relaxed text-ink/85 mb-2">{children}</ul>;

export default function Legal() {
  useEffect(() => {
    document.title = 'Privacy & Terms · Dearly';
    const id = window.location.pathname === '/terms' ? 'terms' : window.location.hash.slice(1);
    if (id) document.getElementById(id)?.scrollIntoView();
    return () => { document.title = 'Dearly'; };
  }, []);

  return (
    <div className="min-h-screen flex justify-center p-4 py-10">
      <article className="bg-paper w-full max-w-2xl p-8 sm:p-10 rounded-sm shadow-2xl text-ink font-sans h-fit">
        <a href="/" className="text-sm text-ink/60 hover:text-heart">← Back to Dearly</a>
        <h1 className="font-handwriting text-5xl mt-3">Privacy &amp; Terms</h1>
        <p className="text-xs text-ink/50 mt-1">Last updated {UPDATED}</p>
        <p className="text-sm mt-3">
          Jump to: <a href="#privacy" className="underline hover:text-heart">Privacy Policy</a> ·{' '}
          <a href="#terms" className="underline hover:text-heart">Terms of Use</a>
        </p>

        <H2 id="privacy">Privacy Policy</H2>
        <P>
          Dearly is a place to write letters to people you care about. This page explains what we collect, why, and
          what you can do about it.
        </P>

        <H3>What we collect</H3>
        <UL>
          <li><strong>Account details:</strong> your name, email address, and password. Passwords are handled by our login provider and are never stored in readable form.</li>
          <li><strong>Profile:</strong> an optional profile photo and a default signature.</li>
          <li><strong>Letters:</strong> the greeting, message, signature, and photos of each letter you send or schedule, along with the recipient's email address.</li>
          <li><strong>Keepsakes and settings:</strong> which letters you starred, and which senders you asked us to stop emailing you about.</li>
          <li><strong>Drafts</strong> are saved in your own browser and are not sent to us.</li>
        </UL>

        <H3>People who don't have an account</H3>
        <P>
          When someone writes you a letter, we email the address they entered to tell you a letter is waiting. If you
          didn't expect it, you can use the "stop emails from this sender" link in that email, or just ignore it. We
          don't use that address for anything else, and we don't send marketing email.
        </P>

        <H3>How it is used</H3>
        <P>
          Only to run Dearly: to show you your letters, deliver them (including scheduled ones), send notification
          emails, and keep the service safe from spam and abuse. We don't sell your data and we don't show ads.
        </P>

        <H3>Who can see your letters</H3>
        <P>
          Inside the app, a letter is visible only to the person who sent it and the person it was addressed to. Letter
          photos are private. Profile photos can be loaded by anyone who has the link. The person who runs Dearly
          has technical access to the database for maintenance, but doesn't read letters.
        </P>

        <H3>Services we rely on</H3>
        <UL>
          <li>A database and login provider (Supabase) stores accounts, letters, and photos.</li>
          <li>A hosting provider (Vercel) serves the website.</li>
          <li>An email delivery service sends notification and password-reset emails.</li>
          <li>Cloudflare Turnstile checks that sign-ups, sign-ins, and password resets come from a real person. It may process your IP address and browser information for that purpose.</li>
        </UL>
        <P>These providers process data on our behalf and may store it on servers outside your country.</P>

        <H3>How long we keep it</H3>
        <P>
          Until you delete it. You can delete individual letters at any time, and you can delete your whole account
          from Profile → Delete my account. That removes your profile, photos, keepsakes, scheduled letters, and every
          letter you sent or received, including from your recipients' inboxes. Backups kept by our providers may
          take a little longer to clear.
        </P>

        <H3>Your rights</H3>
        <P>
          You can view and edit your name, photo, and signature in your profile, and delete your account yourself. If
          you're in the Philippines, you also have rights under the Data Privacy Act of 2012 (access, correction,
          objection, erasure, and the right to complain to the National Privacy Commission). For anything you can't do
          in the app{CONTACT ? ', email ' : '.'}
          {CONTACT && (<><a href={`mailto:${CONTACT}`} className="underline hover:text-heart">{CONTACT}</a>.</>)}
        </P>

        <H3>Children</H3>
        <P>Dearly is not meant for children under 13, and we don't knowingly collect their data.</P>

        <H3>Changes</H3>
        <P>If this policy changes in a meaningful way, we'll update the date above.</P>

        <H2 id="terms">Terms of Use</H2>
        <P>By creating an account or using Dearly, you agree to these terms.</P>

        <H3>Be kind, and be real</H3>
        <UL>
          <li>Only write to people who would reasonably expect to hear from you.</li>
          <li>No spam, advertising, scams, harassment, threats, hate, or anything unlawful.</li>
          <li>Don't send photos or content you don't have the right to share, or that sexualize or endanger anyone, especially children.</li>
          <li>Don't try to break, overload, or get around the limits of the service, including sending letters in bulk.</li>
        </UL>

        <H3>Your content</H3>
        <P>
          Your letters stay yours. You give Dearly permission to store them and show them to the people you send them
          to, which is what the service does. You're responsible for what you write.
        </P>

        <H3>Limits and removal</H3>
        <P>
          To prevent abuse, there's a limit on how many letters you can send per hour and per day. We may remove content
          or suspend accounts that break these terms or put other people at risk.
        </P>

        <H3>Emails you don't want</H3>
        <P>
          Every notification email has a link to stop emails from that sender. Letters still arrive in the app, and you
          can reverse the choice in your profile.
        </P>

        <H3>No guarantees</H3>
        <P>
          Dearly is provided as is. We do our best, but we can't promise it will always be available or that letters or
          scheduled deliveries will never be lost, so keep a copy of anything irreplaceable. To the extent the law
          allows, we're not liable for losses that come from using the service.
        </P>

        <H3>Changes</H3>
        <P>We may update these terms. If you keep using Dearly after a change, you accept the new version.</P>
      </article>
    </div>
  );
}
