import { useState, useRef, useEffect } from 'react';
import { X, Camera, User } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useToast } from './Toast';
import { compressImage } from '../utils/image';
import { avatarUrl, updateMyProfile, uploadAvatar, removeAvatarFile } from '../services/profileService';
import { getBlockedSenders, unblockSender } from '../services/emailBlockService';
import DeleteAccount from './DeleteAccount';
import NotificationSettings from './NotificationSettings';

const BIO_MAX = 200;

export default function ProfileSettings({ user, profile, onClose, onSaved, onAccountDeleted }) {
  const toast = useToast();
  const fallbackName = user.user_metadata?.name || user.email.split('@')[0];

  const [name, setName] = useState(profile?.name || fallbackName);
  const [signature, setSignature] = useState(profile?.default_signature ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [preview, setPreview] = useState(avatarUrl(profile?.avatar_path));
  const [newAvatar, setNewAvatar] = useState(null); // compressed Blob, when a new photo was picked
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [saving, setSaving] = useState(false);

  const fileRef = useRef(null);
  const blobUrlRef = useRef(null);

  const [blocked, setBlocked] = useState([]);
  useEffect(() => {
    getBlockedSenders().then(setBlocked).catch(() => {});
  }, []);

  const allowAgain = async (senderEmail) => {
    try {
      await unblockSender(user.email, senderEmail);
      setBlocked((prev) => prev.filter((e) => e !== senderEmail));
      toast.success(`You'll get email notifications from ${senderEmail} again.`);
    } catch (err) {
      toast.error(`Couldn't update that: ${err.message || 'something went wrong'}`);
    }
  };

  useEffect(
    () => () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    },
    []
  );

  const pickFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file.');
      return;
    }
    try {
      const blob = await compressImage(file, { maxSize: 256, quality: 0.85, square: true });
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = URL.createObjectURL(blob);
      setNewAvatar(blob);
      setPreview(blobUrlRef.current);
      setRemoveAvatar(false);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const clearAvatar = () => {
    setNewAvatar(null);
    setPreview(null);
    setRemoveAvatar(true);
  };

  const save = async () => {
    const cleanName = name.trim();
    if (!cleanName) {
      toast.error("Your name can't be empty.");
      return;
    }
    setSaving(true);
    let uploadedPath = null;
    try {
      const patch = { name: cleanName, default_signature: signature.trim() || null, bio: bio.trim() || null };
      if (newAvatar) {
        uploadedPath = await uploadAvatar(user.id, newAvatar);
        patch.avatar_path = uploadedPath;
      } else if (removeAvatar) {
        patch.avatar_path = null;
      }

      const saved = await updateMyProfile(user.id, patch);

      if ((newAvatar || removeAvatar) && profile?.avatar_path) removeAvatarFile(profile.avatar_path);
      // Keep the sign-up name in sync so everything that reads it stays consistent
      supabase.auth.updateUser({ data: { name: cleanName } }).catch(() => {});

      onSaved(saved);
      toast.success('Profile saved');
      onClose();
    } catch (err) {
      console.error('Failed to save profile:', err);
      if (uploadedPath) removeAvatarFile(uploadedPath);
      toast.error(`Couldn't save your profile: ${err.message || 'something went wrong'}`);
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 flex justify-center items-center p-4 animate-fade-in">
      <div className="bg-paper bg-paper-texture w-full max-w-md rounded-sm shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-ink">
        <div className="bg-paper-dark/50 p-4 border-b border-ink/10 flex justify-between items-center">
          <h2 className="font-handwriting text-2xl">Your Profile</h2>
          <button onClick={onClose} aria-label="Close" className="text-ink-light hover:text-heart transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto font-sans">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-ink/10 border border-ink/20 overflow-hidden flex items-center justify-center shrink-0">
              {preview ? (
                <img src={preview} alt="Your avatar" className="w-full h-full object-cover" />
              ) : (
                <User size={36} className="text-ink/40" />
              )}
            </div>
            <div className="flex flex-col items-start gap-1">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-2 text-sm text-heart hover:underline"
              >
                <Camera size={16} /> {preview ? 'Change photo' : 'Add a photo'}
              </button>
              {preview && (
                <button type="button" onClick={clearAvatar} className="text-xs text-ink/60 hover:text-heart">
                  Remove photo
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickFile} />
            </div>
          </div>

          <label className="block">
            <span className="block text-sm text-ink/70 mb-1">Name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              className="w-full bg-transparent border-b border-ink/30 focus:border-heart outline-none py-2"
            />
          </label>

          <label className="block">
            <span className="block text-sm text-ink/70 mb-1">Default signature</span>
            <input
              type="text"
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              maxLength={80}
              placeholder={`- ${name.trim() || 'Your name'}`}
              className="w-full bg-transparent border-b border-ink/30 focus:border-heart outline-none py-2 font-handwriting text-2xl placeholder-ink/30"
            />
            <span className="block text-xs text-ink/50 mt-1">
              Pre-filled on every new letter. Leave it blank to sign with your name.
            </span>
          </label>

          <label className="block">
            <span className="block text-sm text-ink/70 mb-1">Bio</span>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={BIO_MAX}
              rows={3}
              placeholder="A few words about you..."
              className="w-full bg-transparent border border-ink/20 focus:border-heart rounded-sm outline-none p-2 resize-none text-sm placeholder-ink/30"
            />
            <span className="flex justify-between text-xs text-ink/50 mt-1">
              <span>Everyone who uses Dearly can see this.</span>
              <span>
                {bio.length}/{BIO_MAX}
              </span>
            </span>
          </label>

          <NotificationSettings />

          {blocked.length > 0 && (
            <div>
              <span className="block text-sm text-ink/70 mb-1">Emails turned off for</span>
              <ul className="space-y-1">
                {blocked.map((e) => (
                  <li key={e} className="flex items-center justify-between text-sm">
                    <span className="truncate mr-3">{e}</span>
                    <button type="button" onClick={() => allowAgain(e)} className="text-xs text-heart hover:underline shrink-0">
                      Allow again
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="pt-2 border-t border-ink/10 space-y-3">
            <p className="text-xs text-ink/50">
              Signed in as {user.email} ·{' '}
              <a href="/privacy" target="_blank" rel="noreferrer" className="underline hover:text-heart">Privacy</a> ·{' '}
              <a href="/terms" target="_blank" rel="noreferrer" className="underline hover:text-heart">Terms</a>
            </p>
            <DeleteAccount user={user} onDeleted={() => { onClose(); onAccountDeleted?.(); }} />
          </div>
        </div>

        <div className="p-4 border-t border-ink/10 flex justify-end gap-3 bg-paper-dark/20">
          <button type="button" onClick={onClose} disabled={saving} className="px-4 py-2 text-sm text-ink/70 hover:text-ink">
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="bg-heart text-paper px-6 py-2 rounded-sm font-sans text-sm tracking-wide hover:bg-red-900 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
