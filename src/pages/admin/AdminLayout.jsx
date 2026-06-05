import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { AudioWaveform, ListMusic, MapPin, ArrowLeft } from 'lucide-react';

const adminLinks = [
  { path: '/admin', label: 'Especies', icon: ListMusic },
  { path: '/admin/grabaciones', label: 'Grabaciones del Mapa', icon: MapPin },
];

export default function AdminLayout() {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background">
      {/* Admin header */}
      <header className="bg-primary text-primary-foreground border-b border-primary-foreground/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <AudioWaveform className="w-5 h-5 text-secondary" />
              <span className="font-display font-semibold text-sm tracking-wide">
                Panel de Administración
              </span>
            </div>
            <Link
              to="/"
              className="flex items-center gap-1.5 text-xs text-primary-foreground/70 hover:text-primary-foreground transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Volver al sitio
            </Link>
          </div>
        </div>
      </header>

      {/* Tab nav */}
      <div className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-1">
            {adminLinks.map(link => {
              const Icon = link.icon;
              const isActive = location.pathname === link.path;
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-heading transition-colors border-b-2 ${
                    isActive
                      ? 'border-secondary text-primary font-medium'
                      : 'border-transparent text-muted-foreground hover:text-primary'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </div>
    </div>
  );
}