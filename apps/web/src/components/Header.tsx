import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { Film, Home, Menu, Search, X } from 'lucide-react'

export default function Header() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <header className="px-4 py-3 flex items-center justify-between bg-gray-900 text-white border-b border-gray-800">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsOpen(true)}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors md:hidden"
            aria-label="Open menu"
          >
            <Menu size={24} />
          </button>
          <Link to="/" className="flex items-center gap-2">
            <Film className="w-8 h-8 text-purple-500" />
            <span className="text-xl font-bold">OpnShelf</span>
          </Link>
        </div>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          <Link
            to="/"
            className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors text-gray-300 hover:text-white"
            activeProps={{
              className:
                'flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 transition-colors text-white',
            }}
            activeOptions={{ exact: true }}
          >
            <Home size={18} />
            <span className="font-medium">Home</span>
          </Link>
          <Link
            to="/search"
            className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors text-gray-300 hover:text-white"
            activeProps={{
              className:
                'flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 transition-colors text-white',
            }}
          >
            <Search size={18} />
            <span className="font-medium">Search</span>
          </Link>
        </nav>
      </header>

      {/* Mobile drawer overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={`fixed top-0 left-0 h-full w-72 bg-gray-900 text-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col md:hidden ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Film className="w-6 h-6 text-purple-500" />
            <span className="text-lg font-bold">OpnShelf</span>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            aria-label="Close menu"
          >
            <X size={24} />
          </button>
        </div>

        <nav className="flex-1 p-4 overflow-y-auto">
          <Link
            to="/"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-800 transition-colors mb-2 text-gray-300 hover:text-white"
            activeProps={{
              className:
                'flex items-center gap-3 p-3 rounded-lg bg-purple-600 hover:bg-purple-700 transition-colors mb-2 text-white',
            }}
            activeOptions={{ exact: true }}
          >
            <Home size={20} />
            <span className="font-medium">Home</span>
          </Link>

          <Link
            to="/search"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-800 transition-colors mb-2 text-gray-300 hover:text-white"
            activeProps={{
              className:
                'flex items-center gap-3 p-3 rounded-lg bg-purple-600 hover:bg-purple-700 transition-colors mb-2 text-white',
            }}
          >
            <Search size={20} />
            <span className="font-medium">Search</span>
          </Link>
        </nav>
      </aside>
    </>
  )
}
