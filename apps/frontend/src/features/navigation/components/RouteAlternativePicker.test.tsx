import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouteAlternativePicker } from './RouteAlternativePicker';
import type { RouteInfo } from '../types';

afterEach(() => {
  cleanup();
});

describe('RouteAlternativePicker', () => {
  const mockRoutes: RouteInfo[] = [
    {
      summary: 'via CTE / PIE',
      durationMinutes: 14,
      distanceKm: 9.2,
      traffic: 'Light',
      path: [],
    },
    {
      summary: 'via Upper Thomson Rd',
      durationMinutes: 18,
      distanceKm: 8.5,
      traffic: 'Moderate',
      path: [],
    },
    {
      summary: 'via Marymount Rd',
      durationMinutes: 24,
      distanceKm: 8.9,
      traffic: 'Heavy',
      path: [],
    },
  ];

  it('renders all route alternatives with traffic badges and metrics', () => {
    render(
      <RouteAlternativePicker
        drivingRoutes={mockRoutes}
        activeRouteIndex={0}
        onSelectRoute={vi.fn()}
      />
    );

    expect(screen.getByText('via CTE / PIE')).toBeTruthy();
    expect(screen.getByText('via Upper Thomson Rd')).toBeTruthy();
    expect(screen.getByText('via Marymount Rd')).toBeTruthy();

    expect(screen.getByText('Light')).toBeTruthy();
    expect(screen.getByText('Moderate')).toBeTruthy();
    expect(screen.getByText('Heavy')).toBeTruthy();

    expect(screen.getByText('14 mins')).toBeTruthy();
    expect(screen.getByText('(9.2 km)')).toBeTruthy();
  });

  it('calls onSelectRoute with correct index when route card is clicked', () => {
    const handleSelectRoute = vi.fn();
    render(
      <RouteAlternativePicker
        drivingRoutes={mockRoutes}
        activeRouteIndex={0}
        onSelectRoute={handleSelectRoute}
      />
    );

    fireEvent.click(screen.getByText('via Upper Thomson Rd'));
    expect(handleSelectRoute).toHaveBeenCalledTimes(1);
    expect(handleSelectRoute).toHaveBeenCalledWith(1);
  });
});
