export default function RecipientSelector({ users, selected, onChange }) {
  const toggleRecipient = (user) => {
    if (selected.find((u) => u.id === user.id)) {
      onChange(selected.filter((u) => u.id !== user.id));
    } else {
      onChange([...selected, user]);
    }
  };

  return (
    <div className="mb-4">
      <label className="block text-sm text-gray-400 mb-2">To:</label>
      {users.length === 0 && <p className="text-sm text-ink-light">No friends have signed up yet.</p>}
      <div className="flex flex-wrap gap-2">
        {users.map((user) => (
          <button
            key={user.id}
            onClick={() => toggleRecipient(user)}
            className={`px-3 py-1.5 rounded-full text-sm font-sans transition-colors border ${
              selected.find((u) => u.id === user.id)
                ? 'bg-heart text-white border-heart'
                : 'bg-transparent text-gray-500 border-gray-600 hover:border-gray-400'
            }`}
          >
            {user.name} ({user.email})
          </button>
        ))}
      </div>
    </div>
  );
}