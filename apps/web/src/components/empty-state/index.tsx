import type { LucideIcon } from 'lucide-react';
import { Button } from '../button';
import styles from './styles.module.css';

export interface EmptyStateProps {
  icon: LucideIcon;
  headline: string;
  subline: string;
  action?: { label: string; onClick: () => void };
  tone?: 'neutral' | 'flourish';
}

export function EmptyState({ icon: Icon, headline, subline, action, tone = 'neutral' }: EmptyStateProps) {
  return (
    <div className={styles.root} data-tone={tone}>
      <Icon size={48} aria-hidden="true" className={styles.icon} />
      <h2 className={styles.headline}>{headline}</h2>
      <p className={styles.subline} data-tone={tone}>
        {subline}
      </p>
      {action && (
        <Button variant="secondary" size="md" onClick={action.onClick} className={styles.action}>
          {action.label}
        </Button>
      )}
    </div>
  );
}

export default EmptyState;
