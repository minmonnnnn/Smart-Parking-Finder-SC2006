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
    carpark: { name: 'Sin Ming Multi-Storey Carpark', availableLots: 48 },
    destination: { name: 'MacRitchie Reservoir Park' },
    drivingRoutes: mockDrivingRoutes,
    activeRouteIndex: 0,
    onSelectRoute: vi.fn(),
    walkingInfo: mockWalking,
    isCalculating: false,
    isSheetCollapsed: false,
    onToggleCollapse: vi.fn(),
    onCancelNav: vi.fn(),
  };

  it('renders carpark title and available lots badge', () => {
    render(<NavigationBottomSheet {...defaultProps} />);

    expect(screen.getByText('Sin Ming Multi-Storey Carpark')).toBeTruthy();
    expect(screen.getByText('48 LOTS LEFT')).toBeTruthy();
  });

  it('renders drive and walk metric cards with correct duration and distance', () => {
    render(<NavigationBottomSheet {...defaultProps} />);

    // Drive metric
    expect(screen.getByText('10 mins')).toBeTruthy();
    expect(screen.getByText('Drive (3.5 km)')).toBeTruthy();

    // Walk metric
    expect(screen.getByText('5 mins')).toBeTruthy();
    expect(screen.getByText('Walk (400m)')).toBeTruthy();
  });

  it('displays calculating indicator in metric cards when isCalculating is true', () => {
    render(<NavigationBottomSheet {...defaultProps} isCalculating={true} />);

    const calculatingElements = screen.getAllByText('...');
    expect(calculatingElements.length).toBe(2);
  });

  it('renders weather alert banner with area-specific warning message', () => {
    render(<NavigationBottomSheet {...defaultProps} />);

    expect(
      screen.getByText(
        'Bring an umbrella — rain shower expected at 9:35 around Sin Ming.'
      )
    ).toBeTruthy();
  });

  it('renders custom weather alert when passed as prop', () => {
    render(
      <NavigationBottomSheet
        {...defaultProps}
        weatherAlert="Heavy thunderstorm warning in central Singapore."
      />
    );

    expect(
      screen.getByText('Heavy thunderstorm warning in central Singapore.')
    ).toBeTruthy();
  });

  it('calls onCancelNav when Cancel Navigation button is clicked', () => {
    const onCancelNav = vi.fn();
    render(
      <NavigationBottomSheet {...defaultProps} onCancelNav={onCancelNav} />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cancel Navigation' }));
    expect(onCancelNav).toHaveBeenCalledTimes(1);
  });

  it('toggles collapse when header or drag handle is clicked', () => {
    const onToggleCollapse = vi.fn();
    render(
      <NavigationBottomSheet
        {...defaultProps}
        onToggleCollapse={onToggleCollapse}
      />
    );

    // Clicking the header
    fireEvent.click(screen.getByTitle('Collapse navigation details'));
    expect(onToggleCollapse).toHaveBeenCalledTimes(1);

    // Clicking the drag handle
    fireEvent.click(screen.getByLabelText('Drag handle to collapse'));
    expect(onToggleCollapse).toHaveBeenCalledTimes(2);
  });

  it('collapses when dragged downwards past threshold', () => {
    const onToggleCollapse = vi.fn();
    render(
      <NavigationBottomSheet
        {...defaultProps}
        isSheetCollapsed={false}
        onToggleCollapse={onToggleCollapse}
      />
    );

    const handle = screen.getByLabelText('Drag handle to collapse');
    fireEvent.pointerDown(handle, { clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientY: 160, pointerId: 1 }); // 60px down
    fireEvent.pointerUp(handle, { clientY: 160, pointerId: 1 });

    expect(onToggleCollapse).toHaveBeenCalledTimes(1);
  });

  it('expands when dragged upwards past threshold', () => {
    const onToggleCollapse = vi.fn();
    render(
      <NavigationBottomSheet
        {...defaultProps}
        isSheetCollapsed={true}
        onToggleCollapse={onToggleCollapse}
      />
    );

    const handle = screen.getByLabelText('Drag handle to expand');
    fireEvent.pointerDown(handle, { clientY: 300, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientY: 240, pointerId: 1 }); // 60px up
    fireEvent.pointerUp(handle, { clientY: 240, pointerId: 1 });

    expect(onToggleCollapse).toHaveBeenCalledTimes(1);
  });

  it('hides metric cards, weather alert, and cancel button when collapsed', () => {
    render(
      <NavigationBottomSheet {...defaultProps} isSheetCollapsed={true} />
    );

    expect(screen.getByText('Sin Ming Multi-Storey Carpark')).toBeTruthy();
    expect(screen.getByText('48 LOTS LEFT')).toBeTruthy();
    expect(screen.queryByText('10 mins')).toBeNull();
    expect(screen.queryByText('Drive (3.5 km)')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Cancel Navigation' })).toBeNull();
  });

  it('falls back cleanly to mockup defaults when carpark and routes are missing', () => {
    render(
      <NavigationBottomSheet
        carpark={{ name: '' }}
        drivingRoutes={[]}
        activeRouteIndex={0}
      />
    );

    expect(screen.getByText('Bishan Park II')).toBeTruthy();
    expect(screen.getByText('42 LOTS LEFT')).toBeTruthy();
    expect(screen.getByText('5 mins')).toBeTruthy();
    expect(screen.getByText('Drive (1.6 km)')).toBeTruthy();
    expect(screen.getByText('2 mins')).toBeTruthy();
    expect(screen.getByText('Walk (200m)')).toBeTruthy();
    expect(
      screen.getByText(
        'Bring an umbrella — rain shower expected at 9:35 around Bishan.'
      )
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cancel Navigation' })).toBeTruthy();
  });

  it('renders fair weather info banner when weatherInfo has no rain expected', () => {
    render(
      <NavigationBottomSheet
        {...defaultProps}
        weatherInfo={{
          condition: 'Partly Cloudy',
          rainExpected: false,
          forecastSummary: 'Partly Cloudy expected around Sin Ming',
          retrievedAt: new Date().toISOString(),
        }}
      />
    );

    expect(
      screen.getByText('Partly Cloudy around Sin Ming • No rain expected')
    ).toBeTruthy();
  });

  it('renders dynamic rain alert banner when weatherInfo has rain expected', () => {
    render(
      <NavigationBottomSheet
        {...defaultProps}
        weatherInfo={{
          condition: 'Heavy Thundery Showers',
          rainExpected: true,
          forecastSummary: 'Heavy Thundery Showers expected around Sin Ming',
          retrievedAt: new Date().toISOString(),
        }}
      />
    );

    expect(
      screen.getByText(
        'Bring an umbrella — heavy thundery showers expected around Sin Ming.'
      )
    ).toBeTruthy();
  });
});
