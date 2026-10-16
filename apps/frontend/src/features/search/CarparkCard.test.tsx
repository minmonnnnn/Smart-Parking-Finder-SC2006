import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CarparkCard } from './CarparkCard';
import {
  availabilityTone,
  formatDistance,
  toCarparkCardData,
  type CarparkCardData,
} from './carparkCardUtils';

describe('CarparkCard', () => {
  afterEach(() => {
    cleanup();
  });

  const dummyCarpark: CarparkCardData = {
    carParkNo: 'B283',
    name: 'Blk 283 Bishan Street 22',
    distanceMeters: 850,
    walkingEtaMinutes: 10,
    availableLots: 95,
    totalLots: 120,
    isSheltered: true,
    hasEvCharging: true,
    parkingCost: 0.4,
    carparkType: 'Multi-storey',
    latitude: 1.359,
    longitude: 103.851,
  };

  it('renders carpark details, distance, walking time, and availability metrics', () => {
    render(<CarparkCard cp={dummyCarpark} />);

    expect(screen.getByText('Blk 283 Bishan Street 22')).toBeDefined();
    expect(screen.getByText('850 m · 10 min walk')).toBeDefined();
    expect(screen.getByText('95 / 120')).toBeDefined();
    expect(screen.getByText('79% free')).toBeDefined();
    expect(screen.getByText('Sheltered')).toBeDefined();
    expect(screen.getByText('EV')).toBeDefined();
    expect(screen.getByText('$0.40/hr')).toBeDefined();
    expect(screen.getByText('Multi-storey')).toBeDefined();
  });

  it('calls onNavigate when Navigate button is clicked', () => {
    const handleNavigate = vi.fn();
    render(<CarparkCard cp={dummyCarpark} onNavigate={handleNavigate} />);

    const navButton = screen.getByRole('button', { name: /Navigate to Blk 283 Bishan Street 22/i });
    fireEvent.click(navButton);

    expect(handleNavigate).toHaveBeenCalledTimes(1);
    expect(handleNavigate).toHaveBeenCalledWith(dummyCarpark);
  });

  it('calls onSelect when card body is clicked', () => {
    const handleSelect = vi.fn();
    render(<CarparkCard cp={dummyCarpark} onSelect={handleSelect} />);

    const titleElement = screen.getByText('Blk 283 Bishan Street 22');
    fireEvent.click(titleElement);

    expect(handleSelect).toHaveBeenCalledTimes(1);
    expect(handleSelect).toHaveBeenCalledWith(dummyCarpark);
  });

  it('formats distance in meters and kilometers correctly', () => {
    expect(formatDistance(500)).toBe('500 m');
    expect(formatDistance(1200)).toBe('1.2 km');
  });

  it('computes availabilityTone correctly', () => {
    expect(availabilityTone(35)).toBe('success');
    expect(availabilityTone(20)).toBe('warning');
    expect(availabilityTone(5)).toBe('danger');
  });

  it('transforms API response to CarparkCardData using toCarparkCardData', () => {
    const rawApiItem = {
      carpark: {
        carParkNo: 'B20',
        address: 'Bishan Park II',
        latitude: 1.362,
        longitude: 103.848,
        carParkType: 'Surface',
        isSheltered: false,
        totalLots: 120,
        hasEvCharging: false,
        parkingCost: null,
      },
      availability: {
        availableLots: 42,
        totalLots: 120,
        status: 'High',
      },
      distanceMeters: 1200,
      walkingEtaMinutes: 14,
    };

    const cardData = toCarparkCardData(rawApiItem);
    expect(cardData.carParkNo).toBe('B20');
    expect(cardData.name).toBe('Bishan Park II');
    expect(cardData.distanceMeters).toBe(1200);
    expect(cardData.walkingEtaMinutes).toBe(14);
    expect(cardData.availableLots).toBe(42);
    expect(cardData.totalLots).toBe(120);
    expect(cardData.isSheltered).toBe(false);
  });
});
