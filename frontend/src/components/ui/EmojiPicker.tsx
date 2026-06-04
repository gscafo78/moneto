const EMOJIS = [
  // Finance & conti
  '💳','💵','💰','💸','🏦','💴','💹','🪙','💎','📊',
  // Cibo
  '🍕','🍔','🍣','🥗','🍷','☕','🍺','🛒','🥩','🍰',
  // Trasporti
  '🚗','✈️','🚂','🚢','🚲','🛵','⛽','🚕','🚌','🛺',
  // Casa
  '🏠','🏡','🔑','💡','🔧','🛋️','🛁','🔨','🌿','🪴',
  // Salute
  '💊','🏥','🧘','🏋️','🩺','🦷','🧴','🩹','🌡️','🏃',
  // Intrattenimento
  '🎭','🎬','🎮','🎵','🎨','⚽','🎸','📺','🎤','🎲',
  // Shopping
  '👕','👗','👠','🛍️','💄','⌚','👜','🧥','🕶️','👟',
  // Tecnologia
  '📱','💻','🖥️','📷','🎧','🖨️','⌨️','🖱️','📡','🔋',
  // Istruzione
  '📚','✏️','🎓','📝','🔬','📐','🗂️','📖','🏫','🖊️',
  // Viaggi
  '🗺️','🌍','🏖️','🏔️','🌅','🎠','🗼','🏕️','🌴','🧳',
  // Lavoro
  '💼','📎','📋','🖊️','📌','🗃️','📂','💡','🏢','🤝',
  // Altro
  '🎁','⭐','❤️','🌱','🐾','🎀','🔑','✨','🙏','🎯',
]

interface Props {
  value: string
  onChange: (emoji: string) => void
}

export default function EmojiPicker({ value, onChange }: Props) {
  return (
    <div className="grid grid-cols-8 gap-1 max-h-44 overflow-y-auto py-1">
      {EMOJIS.map(e => (
        <button
          key={e}
          type="button"
          onClick={() => onChange(e)}
          className={`text-2xl p-1.5 rounded-lg transition active:scale-90 ${
            value === e ? 'bg-brand/30 ring-1 ring-brand' : 'hover:bg-white/10'
          }`}
        >
          {e}
        </button>
      ))}
    </div>
  )
}
