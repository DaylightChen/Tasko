import type { Theme, WeekStart } from '@tasko/types';
import { useConfig, useUpdateConfig } from '../../api/config';
import { Button } from '../../components/button';
import { useShortcutHelpStore } from '../../store/shortcut-help';
import styles from './styles.module.css';

export function SettingsView() {
  const { data: config } = useConfig();
  const updateConfig = useUpdateConfig();
  const shortcutHelp = useShortcutHelpStore();

  const theme = config?.theme ?? 'system';
  const weekStart = config?.week_start ?? 'mon';

  const handleThemeChange = (value: Theme) => {
    updateConfig.mutate({ theme: value });
  };

  const handleWeekStartChange = (value: WeekStart) => {
    updateConfig.mutate({ week_start: value });
  };

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Settings</h1>

      {/* Appearance section */}
      <section className={styles.section} aria-labelledby="appearance-heading">
        <h2 className={styles.sectionHeading} id="appearance-heading">
          APPEARANCE
        </h2>

        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>Theme</legend>

          <label className={styles.radioLabel}>
            <input
              type="radio"
              name="theme"
              value="light"
              checked={theme === 'light'}
              onChange={() => handleThemeChange('light')}
            />
            <span>Light</span>
          </label>

          <label className={styles.radioLabel}>
            <input
              type="radio"
              name="theme"
              value="dark"
              checked={theme === 'dark'}
              onChange={() => handleThemeChange('dark')}
            />
            <span>Dark</span>
          </label>

          <label className={styles.radioLabel}>
            <input
              type="radio"
              name="theme"
              value="system"
              checked={theme === 'system'}
              onChange={() => handleThemeChange('system')}
            />
            <span>System (default)</span>
          </label>
        </fieldset>
      </section>

      {/* Week section */}
      <section className={styles.section} aria-labelledby="week-heading">
        <h2 className={styles.sectionHeading} id="week-heading">
          WEEK
        </h2>

        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>Start of week</legend>

          <label className={styles.radioLabel}>
            <input
              type="radio"
              name="week_start"
              value="sun"
              checked={weekStart === 'sun'}
              onChange={() => handleWeekStartChange('sun')}
            />
            <span>Sunday</span>
          </label>

          <label className={styles.radioLabel}>
            <input
              type="radio"
              name="week_start"
              value="mon"
              checked={weekStart === 'mon'}
              onChange={() => handleWeekStartChange('mon')}
            />
            <span>Monday (default)</span>
          </label>
        </fieldset>
      </section>

      {/* About section */}
      <section className={styles.section} aria-labelledby="about-heading">
        <h2 className={styles.sectionHeading} id="about-heading">
          ABOUT
        </h2>
        <p className={styles.aboutText}>Tasko v1.0 · Local-first</p>
        <Button variant="ghost" size="md" onClick={() => shortcutHelp.show()}>
          View keyboard shortcuts
        </Button>
      </section>
    </div>
  );
}
