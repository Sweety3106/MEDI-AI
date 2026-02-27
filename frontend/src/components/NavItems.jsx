import {
    Home,
    Stethoscope,
    History,
    Pill,
    User,
    LayoutDashboard,
    AlertCircle,
    Users,
    FileText,
    Settings,
    ShieldAlert
} from 'lucide-react';

export const navItems = {
    patient: [
        { label: 'Dashboard', icon: Home, path: '/' },
        { label: 'Check Symptoms', icon: Stethoscope, path: '/symptoms', primary: true },
        { label: 'My History', icon: History, path: '/history' },
        { label: 'Medications', icon: Pill, path: '/drugs' },
        { label: 'Profile', icon: User, path: '/profile' },
    ],
    doctor: [
        { label: 'Dashboard', icon: LayoutDashboard, path: '/doctor' },
        { label: 'Alerts', icon: AlertCircle, path: '/doctor/alerts', badge: 'alerts' },
        { label: 'My Patients', icon: Users, path: '/doctor/patients' },
        { label: 'Clinical Review', icon: FileText, path: '/doctor/review' },
        { label: 'Settings', icon: Settings, path: '/settings' },
    ],
    admin: [
        { label: 'Analytics', icon: LayoutDashboard, path: '/admin' },
        { label: 'Users', icon: Users, path: '/admin/users' },
        { label: 'System Alerts', icon: ShieldAlert, path: '/admin/alerts' },
        { label: 'Settings', icon: Settings, path: '/settings' },
    ]
};
