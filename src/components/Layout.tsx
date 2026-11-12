import { NavLink, Outlet } from 'react-router-dom';
import { IconHome, IconPerson, IconShelf } from './Icons';

export const Brand = () => (
  <span className="brand"><span className="ribbon" aria-hidden="true" />Minha Estante</span>
);

/** Abas principais: no topo no computador, barra inferior no celular. */
export function Layout() {
  return (
    <>
      <nav id="nav" aria-label="Navegação principal">
        <div className="nav-in">
          <Brand />
          <div className="nav-tabs">
            <NavLink to="/" end className="tab" id="tab-inicio"><IconHome /><span>Início</span></NavLink>
            <NavLink to="/estante" className="tab" id="tab-estante"><IconShelf /><span>Estante</span></NavLink>
            <NavLink to="/perfil" className="tab" id="tab-perfil"><IconPerson /><span>Perfil</span></NavLink>
          </div>
        </div>
      </nav>
      <main className="wrap">
        <header className="apphead"><Brand /></header>
        <Outlet />
      </main>
    </>
  );
}
