import { NavLink } from 'react-router-dom'
import { PieChart, ArrowLeftRight, Wallet, Tag, Repeat, FileBarChart } from 'lucide-react'

const tabs = [
  { to: '/',             Icon: PieChart,          label: 'Home'        },
  { to: '/transactions', Icon: ArrowLeftRight,     label: 'Movimenti'   },
  { to: '/accounts',     Icon: Wallet,             label: 'Conti'       },
  { to: '/categories',   Icon: Tag,                label: 'Categorie'   },
  { to: '/recurring',    Icon: Repeat,             label: 'Ricorrenti'  },
  { to: '/report',       Icon: FileBarChart,       label: 'Report'      },
]

export default function BottomNav() {
  return (
    <nav className="flex bg-[#1a1a24] border-t border-white/10 px-2 py-1 gap-1 safe-bottom">
      {tabs.map(({ to, Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center gap-0.5 py-2 rounded-xl text-xs font-medium transition-colors min-h-[52px] justify-center
             ${isActive ? 'text-indigo-400 bg-indigo-400/10' : 'text-white/40 hover:text-white/70'}`
          }
        >
          <Icon size={22} strokeWidth={1.8} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
