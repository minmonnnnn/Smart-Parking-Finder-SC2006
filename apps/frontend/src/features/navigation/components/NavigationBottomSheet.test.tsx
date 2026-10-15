import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NavigationBottomSheet } from './NavigationBottomSheet';
import type { RouteInfo, WalkingInfo } from '../types';

afterEach(() => {
  cleanup();
});

describe('NavigationBottomSheet', () => {
  const mockDrivingRoutes: RouteInfo[] = [
    {
      summary: 'via Sin Ming Rd',
      durationMinutes: 10,
      distanceKm: 3.5,
      traffic: 'Light',
      path: [],
    },
  ];

  const mockWalking: WalkingInfo = {
    durationMinutes: 5,
    distanceMeters: 400,
    path: [],
  };

  const defaultProps = {
    origin: { name: 'Ang Mo Kio Ave 1' },
    carpark: { name: 'Sin Ming Multi-Storey Carpark' },
    destination: { name: 'MacRitchie Reservoir Park' },
    drivingRoutes: mockDrivingRoutes,
    activeRouteIndex: 0,
    onSelectRoute: vi.fn(),
    walkingInfo: mockWalking,
    isCalculating: false,
    isSheetCollapsed: false,
    onToggleCollapse: vi.fn(),
    onOpenTargetSearch: vi.fn(),
    onCancelNav: vi.fn(),
  };

  it('calculates and displays total ETA (drive + walk)', () => {
    render(<NavigationBottomSheet {...defaultProps} />);

    // Total = 10 mins drive + 5 mins walk = 15 mins
    expect(screen.getByText('15')).toBeTruthy();
    expect(screen.getByText('mins total')).toBeTruthy();
  });

  it('displays calculating status when routes are updating', () => {
    render(<NavigationBottomSheet {...defaultProps} isCalculating={true} />);

    expect(screen.getByText('Calculating ETA...')).toBeTruthy();
  });

  it('renders origin, carpark, and destination information', () => {
    render(<NavigationBottomSheet {...defaultProps} />);

    expect(screen.getByText(/Ang Mo Kio Ave 1/)).toBeTruthy();
    expect(screen.getByText(/Sin Ming Multi-Storey Carpark/)).toBeTruthy();
    expect(screen.getByText(/MacRitchie Reservoir Park/)).toBeTruthy();
  });

  it('calls onOpenTargetSearch when a location row is clicked', () => {
    const onOpenTargetSearch = vi.fn();
    render(
      <NavigationBottomSheet
        {...defaultProps}
        onOpenTargetSearch={onOpenTargetSearch}
      />
    );

    fireEvent.click(screen.getByText('Change A'));
    expect(onOpenTargetSearch).toHaveBeenCalledWith('origin');

    fireEvent.click(screen.getByText('Change P'));
    expect(onOpenTargetSearch).toHaveBeenCalledWith('carpark');

    fireEvent.click(screen.getByText('Change B'));
    expect(onOpenTargetSearch).toHaveBeenCalledWith('destination');
  });

  it('calls onCancelNav when cancel button is clicked', () => {
    const onCancelNav = vi.fn();
    render(<NavigationBottomSheet {...defaultProps} onCancelNav={onCancelNav} />);

    fireEvent.click(screen.getByText('Cancel Nav'));
    expect(onCancelNav).toHaveBeenCalledTimes(1);
  });

  it('toggles collapse when handle is clicked', () => {
    const onToggleCollapse = vi.fn();
    render(
      <NavigationBottomSheet
        {...defaultProps}
        onToggleCollapse={onToggleCollapse}
      />
    );

    fireEvent.click(screen.getByTitle('Collapse navigation details'));
    expect(onToggleCollapse).toHaveBeenCalledTimes(1);
  });
});

