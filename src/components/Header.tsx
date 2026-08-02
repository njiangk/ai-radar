import { Cpu, Newspaper, Radar } from 'lucide-react';
import { NavLink } from 'react-router-dom';

export function Header() {
  return (
    <header className="site-header">
      <div className="header-inner">
        <NavLink to="/" className="brand" aria-label="AI Radar 首页">
          <Radar size={20} aria-hidden="true" />
          <span>AI Radar</span>
        </NavLink>
        <nav className="main-nav" aria-label="主导航">
          <NavLink
            to="/"
            end
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
          >
            <Newspaper size={16} aria-hidden="true" />
            新闻
          </NavLink>
          <NavLink
            to="/models"
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
          >
            <Cpu size={16} aria-hidden="true" />
            模型对比
          </NavLink>
        </nav>
      </div>
    </header>
  );
}
