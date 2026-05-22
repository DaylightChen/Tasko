import { createFileRoute } from '@tanstack/react-router';
import { AllView } from '../views/all-view';

export const Route = createFileRoute('/all')({
  component: AllView,
});
