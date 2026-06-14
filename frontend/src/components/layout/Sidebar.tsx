import { NavLink } from 'react-router-dom'
import { PieChart, ArrowLeftRight, Wallet, Tag, Repeat, FileBarChart, Settings, Wallet2 } from 'lucide-react'

const items = [
  { to: '/',             Icon: PieChart,      label: 'Home'         },
  { to: '/transactions', Icon: ArrowLeftRight, label: 'Movimenti'    },
  { to: '/accounts',     Icon: Wallet,         label: 'Conti'        },
  { to: '/categories',   Icon: Tag,            label: 'Categorie'    },
  { to: '/recurring',    Icon: Repeat,         label: 'Ricorrenti'   },
  { to: '/report',       Icon: FileBarChart,   label: 'Report'       },
  { to: '/settings',     Icon: Settings,       label: 'Impostazioni' },
]

export default function Sidebar() {
  return (
    <aside className="hidden md:flex w-64 min-h-screen bg-surface border-r border-white/10 flex-col">
      <div className="flex items-center gap-2 px-6 py-5 border-b border-white/10">
        <Wallet2 size={24} className="text-brand" />
        <span className="text-lg font-bold tracking-wide">Moneto</span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {items.map(({ to, Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-brand/10 text-brand'
                  : 'text-white/50 hover:bg-white/5 hover:text-white/80'
              }`
            }
          >
            <Icon size={18} strokeWidth={1.8} className="flex-shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
