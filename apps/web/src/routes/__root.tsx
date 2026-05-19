import { Outlet, createRootRoute } from '@tanstack/react-router';
import { Sidebar } from '../components/sidebar';
import styles from './__root.module.css';

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  return (
    <>
      <a href="#main" className="skip-link">
        Skip to main content
      </a>
      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <Sidebar />
        </aside>
        <main id="main" className={styles.main}>
          <Outlet />
        </main>
      </div>
    </>
  );
}
