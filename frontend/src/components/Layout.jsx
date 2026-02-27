import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
    Menu,
    X,
    Bell,
    Search,
    ChevronRight,
    LogOut,
    User as UserIcon,
    Plus
} from 'lucide-react';
import { navItems } from './NavItems';
import { cn } from '../utils/cn'; // Assuming we have a cn utility, if not I'll create it

const Layout = ({ children, user = { name: 'Dr. Rajnikant', role: 'doctor' } }) => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const location = useLocation();
    const navigate = useNavigate();

    const currentNav = navItems[user.role] || navItems.patient;

    // Collapse sidebar on smaller desktops
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth < 1024) setIsSidebarOpen(false);
            else setIsSidebarOpen(true);
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
            {/* ─── DESKTOP SIDEBAR ───────────────────────────────────── */}
            <aside
                className={cn(
                    "hidden md:flex flex-col bg-white border-r border-slate-200 transition-all duration-300 ease-in-out z-30",
                    isSidebarOpen ? "w-64" : "w-20"
                )}
            >
                {/* Brand */}
                <div className="h-16 flex items-center px-6 border-b border-slate-100">
                    <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
                        M
                    </div>
                    {isSidebarOpen && (
                        <span className="ml-3 font-extrabold text-slate-800 text-xl tracking-tight">
                            Medi<span className="text-teal-600">AI</span>
                        </span>
                    )}
                </div>

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-2">
                    {currentNav.map((item) => {
                        const Icon = item.icon;
                        const isActive = location.pathname === item.path;

                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={cn(
                                    "flex items-center px-3 py-3 rounded-xl transition-all duration-200 group relative",
                                    isActive
                                        ? "bg-teal-50 text-teal-700 shadow-sm"
                                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-900",
                                    !isSidebarOpen && "justify-center"
                                )}
                            >
                                <Icon className={cn(
                                    "w-5 h-5",
                                    isActive ? "text-teal-600" : "group-hover:text-teal-500"
                                )} />
                                {isSidebarOpen && (
                                    <span className="ml-3 font-medium text-sm">{item.label}</span>
                                )}
                                {isActive && !isSidebarOpen && (
                                    <div className="absolute left-0 w-1 h-6 bg-teal-600 rounded-r-full" />
                                )}
                                {item.primary && isSidebarOpen && (
                                    <div className="ml-auto w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
                                )}
                            </Link>
                        );
                    })}
                </nav>

                {/* User Mini Profile / Logout */}
                <div className="p-4 border-t border-slate-100">
                    <button
                        onClick={() => {/* handle logout */ }}
                        className={cn(
                            "flex items-center w-full px-3 py-3 rounded-xl text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors group",
                            !isSidebarOpen && "justify-center"
                        )}
                    >
                        <LogOut className="w-5 h-5" />
                        {isSidebarOpen && <span className="ml-3 font-medium text-sm">Logout</span>}
                    </button>
                </div>
            </aside>

            {/* ─── MAIN CONTENT ────────────────────────────────────────── */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">

                {/* Header */}
                <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-20 flex items-center justify-between px-4 md:px-8">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                            className="hidden md:flex p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
                        >
                            <Menu className="w-5 h-5" />
                        </button>
                        <div className="md:hidden flex items-center">
                            <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center text-white font-bold text-lg">
                                M
                            </div>
                        </div>
                        {/* Breadcrumb or Page Title Placeholder */}
                        <div className="hidden sm:flex items-center text-sm text-slate-400 gap-2">
                            <span>MediAI</span>
                            <ChevronRight className="w-3 h-3" />
                            <span className="text-slate-800 font-medium capitalize">
                                {location.pathname.split('/')[1] || 'Dashboard'}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 md:gap-4">
                        <div className="relative hidden lg:block">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search patient, symptoms..."
                                className="bg-slate-100 border-none rounded-full pl-10 pr-4 py-2 text-sm w-64 focus:ring-2 focus:ring-teal-500/20 transition-all outline-none"
                            />
                        </div>

                        <button
                            className="relative p-2 rounded-full hover:bg-slate-100 text-slate-500 transition-colors"
                            onClick={() => setShowNotifications(!showNotifications)}
                        >
                            <Bell className="w-5 h-5" />
                            <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center font-bold border-2 border-white">
                                3
                            </span>
                        </button>

                        <div className="h-8 w-px bg-slate-200 mx-1" />

                        <button className="flex items-center gap-2 pl-1 pr-1 sm:pr-2 py-1 rounded-full hover:bg-slate-100 transition-colors">
                            <div className="w-8 h-8 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center overflow-hidden">
                                <UserIcon className="w-4 h-4 text-slate-500" />
                            </div>
                            <div className="hidden sm:block text-left">
                                <div className="text-xs font-bold text-slate-800 leading-none">{user.name}</div>
                                <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mt-0.5">{user.role}</div>
                            </div>
                        </button>
                    </div>
                </header>

                {/* Viewport */}
                <main className="flex-1 overflow-y-auto p-4 md:p-8 pb-24 md:pb-8">
                    <div className="max-w-6xl mx-auto">
                        {children}
                    </div>
                </main>

                {/* ─── MOBILE BOTTOM NAV ──────────────────────────────────── */}
                <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 flex items-center justify-around h-16 px-2 z-40 shadow-[0_-4px_10px_rgba(0,0,0,0.03)]">
                    {currentNav.filter(i => !i.primary).slice(0, 4).map((item) => {
                        const Icon = item.icon;
                        const isActive = location.pathname === item.path;
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={cn(
                                    "flex flex-col items-center justify-center gap-1 min-w-[64px]",
                                    isActive ? "text-teal-600" : "text-slate-400"
                                )}
                            >
                                <Icon className="w-5 h-5" />
                                <span className="text-[10px] font-bold uppercase tracking-tight">{item.label}</span>
                            </Link>
                        );
                    })}
                    {/* Central Floating Action button for Mobile */}
                    <button
                        onClick={() => navigate('/symptoms')}
                        className="w-12 h-12 rounded-full bg-teal-600 text-white flex items-center justify-center -mt-8 shadow-lg shadow-teal-500/40 border-4 border-white"
                    >
                        <Plus className="w-6 h-6" />
                    </button>
                </nav>
            </div>
        </div>
    );
};

export default Layout;
