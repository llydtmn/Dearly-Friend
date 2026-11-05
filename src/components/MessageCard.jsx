export default function MessageCard({ message, onClick, isActive, currentEmail }) {
  const isSent = message.senderEmail.toLowerCase() === currentEmail;
  const isUnread = !message.isRead && !isSent;
  const date = new Date(message.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <div
      onClick={onClick}
      className={`flex justify-between items-center p-4 border-b border-gray-700/50 cursor-pointer transition-colors hover:bg-white/5 ${isActive ? 'bg-white/10' : ''}`}
    >
      <div className="flex items-center gap-3">
        {isUnread && <div className="w-2 h-2 rounded-full bg-heart"></div>}
        <span className={`font-sans text-sm ${isUnread ? 'text-paper font-medium' : 'text-gray-400'}`}>
          {isSent ? `You sent a message to ${message.recipientEmail}` : `${message.senderEmail} sent you a message`}
        </span>
      </div>
      <span className="font-sans text-xs text-gray-500">[ {date} ]</span>
    </div>
  );
}