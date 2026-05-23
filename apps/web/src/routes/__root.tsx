import { Outlet, createRootRoute } from '@tanstack/react-router';
import { CommandPaletteHost } from '../app/command-palette-host';
import { Sidebar } from '../components/sidebar';
import { TaskModal } from '../views/task-modal';
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
      {/* Mounted here (inside the router tree) so its useNavigate() has router
          context — see main.tsx comment for why a sibling-of-RouterProvider
          placement silently broke navigation. */}
      <CommandPaletteHost />
      {/* Global TaskModal — mounts once; opens in edit mode when rows trigger taskModalStore.openEdit */}
      <TaskModal />
    </>
  );
}
