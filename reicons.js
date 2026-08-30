import Activity from './assets/reicon/icons/Activity.js'
import ArrowRight from './assets/reicon/icons/ArrowRight.js'
import ArrowUp from './assets/reicon/icons/ArrowUp.js'
import ArrowUpRight from './assets/reicon/icons/ArrowUpRight.js'
import BookOpen from './assets/reicon/icons/BookOpen.js'
import BoxAdd from './assets/reicon/icons/BoxAdd.js'
import ChatRoundDots from './assets/reicon/icons/ChatRoundDots.js'
import Check from './assets/reicon/icons/Check.js'
import Code from './assets/reicon/icons/Code.js'
import Confetti from './assets/reicon/icons/Confetti.js'
import Download from './assets/reicon/icons/Download.js'
import Globe from './assets/reicon/icons/Globe.js'
import Microphone from './assets/reicon/icons/Microphone.js'
import Search from './assets/reicon/icons/Search.js'
import ShieldCheck from './assets/reicon/icons/ShieldCheck.js'
import Store from './assets/reicon/icons/Store.js'
import Xmark from './assets/reicon/icons/Xmark.js'

const reicons = {
  Activity,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  BookOpen,
  BoxAdd,
  ChatRoundDots,
  Check,
  Code,
  Confetti,
  Download,
  Globe,
  Microphone,
  Search,
  ShieldCheck,
  Store,
  Xmark,
}

const hydrateReicons = (root = document) => {
  root.querySelectorAll('[data-reicon]').forEach(slot => {
    if (slot.querySelector('svg.reicon')) return
    const Icon = reicons[slot.dataset.reicon]
    if (!Icon) return
    const size = Number(slot.dataset.reiconSize) || 16
    const icon = Icon({ size, attrs: { 'aria-hidden': 'true', focusable: 'false' } })
    slot.replaceChildren(icon)
  })
}

hydrateReicons()

export { Confetti, Microphone, hydrateReicons }
