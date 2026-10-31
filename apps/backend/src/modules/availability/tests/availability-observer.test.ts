import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AvailabilityAlertSubject,
  CallbackAlertObserver,
  ConsoleAlertObserver,
  InMemoryAlertObserver,
  type AvailabilityNotification,
  type IAvailabilityObserver,
} from "../observers/index.js";
import type {
  AlertRepository,
  StoredAvailabilityAlert,
} from "../alerts.repository.js";
import type { AvailabilityRepository } from "../repository.js";
import type { AvailabilityInfo } from "../service.js";

describe("GoF Observer Pattern: Availability Alerts", () => {
  const sampleNotification: AvailabilityNotification = {
    alertId: 101,
    userId: "usr-42",
    carParkNo: "HE12",
    previousStatus: "High",
    currentStatus: "Low",
  };

  describe("AvailabilityAlertSubject registration & broadcast", () => {
    it("attaches, detaches, and tracks observers", () => {
      const subject = new AvailabilityAlertSubject();
      const observer1 = new InMemoryAlertObserver();
      const observer2 = new ConsoleAlertObserver();

      expect(subject.getObservers()).toHaveLength(0);

      subject.attach(observer1);
      subject.attach(observer2);
      expect(subject.getObservers()).toEqual([observer1, observer2]);

      subject.detach(observer1);
      expect(subject.getObservers()).toEqual([observer2]);
    });

    it("notifies all registered observers", async () => {
      const subject = new AvailabilityAlertSubject();
      const inMemoryObserver = new InMemoryAlertObserver();
      const mockUpdate = vi.fn();
      const mockObserver: IAvailabilityObserver = {
        name: "MockObserver",
        update: mockUpdate,
      };

      subject.attach(inMemoryObserver);
      subject.attach(mockObserver);

      await subject.notify(sampleNotification);

      expect(inMemoryObserver.getNotifications()).toEqual([sampleNotification]);
      expect(mockUpdate).toHaveBeenCalledWith(sampleNotification);
    });

    it("continues notifying remaining observers if one throws an error", async () => {
      const subject = new AvailabilityAlertSubject();
      const failingObserver: IAvailabilityObserver = {
        name: "FailingObserver",
        update: vi.fn().mockRejectedValue(new Error("Network timeout")),
      };
      const receivingObserver = new InMemoryAlertObserver();

      subject.attach(failingObserver);
      subject.attach(receivingObserver);

      await expect(subject.notify(sampleNotification)).rejects.toThrow("Network timeout");
      expect(receivingObserver.getNotifications()).toEqual([sampleNotification]);
    });
  });

  describe("Concrete Observers", () => {
    it("CallbackAlertObserver adapts a callback function", async () => {
      const callback = vi.fn().mockResolvedValue(undefined);
      const observer = new CallbackAlertObserver(callback, "CustomCallback");

      expect(observer.name).toBe("CustomCallback");
      await observer.update(sampleNotification);
      expect(callback).toHaveBeenCalledWith(sampleNotification);
    });

    it("InMemoryAlertObserver records and clears notifications", () => {
      const observer = new InMemoryAlertObserver();
      expect(observer.getNotifications()).toEqual([]);

      observer.update(sampleNotification);
      expect(observer.getNotifications()).toHaveLength(1);

      observer.clear();
      expect(observer.getNotifications()).toHaveLength(0);
    });

    it("ConsoleAlertObserver logs formatted notification without throwing", () => {
      const observer = new ConsoleAlertObserver();
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      observer.update(sampleNotification);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[AVAILABILITY ALERT] Alert #101 for User \"usr-42\""),
      );
      consoleSpy.mockRestore();
    });
  });

  describe("AvailabilityAlertSubject.checkAlerts integration", () => {
    let alert: StoredAvailabilityAlert;
    const getEnabledAlerts = vi.fn<AlertRepository["getEnabledAlerts"]>();
    const updateAlertLastKnownStatus =
      vi.fn<AlertRepository["updateAlertLastKnownStatus"]>();
    const getAvailabilityByCarParkNo =
      vi.fn<AvailabilityRepository["getAvailabilityByCarParkNo"]>();

    const dependencies = {
      alerts: { getEnabledAlerts, updateAlertLastKnownStatus },
      availability: { getAvailabilityByCarParkNo },
    };

    const availabilityRecord: AvailabilityInfo = {
      availableLots: 15,
      totalLots: 100,
      status: "Low",
      lastUpdated: new Date().toISOString(),
      isStale: false,
    };

    beforeEach(() => {
      vi.resetAllMocks();

      alert = {
        id: 7,
        userId: "test-user",
        carParkNo: "ACB1",
        enabled: true,
        lastKnownStatus: "High",
      };

      getEnabledAlerts.mockResolvedValue([alert]);
      getAvailabilityByCarParkNo.mockResolvedValue(availabilityRecord);
      updateAlertLastKnownStatus.mockResolvedValue({
        ...alert,
        lastKnownStatus: "Low",
      });
    });

    it("publishes to attached observers and updates status in repository", async () => {
      const subject = new AvailabilityAlertSubject();
      const inMemory = new InMemoryAlertObserver();
      subject.attach(inMemory);

      await subject.checkAlerts(dependencies);

      expect(inMemory.getNotifications()).toHaveLength(1);
      expect(inMemory.getNotifications()[0]).toMatchObject({
        alertId: 7,
        userId: "test-user",
        carParkNo: "ACB1",
        previousStatus: "High",
        currentStatus: "Low",
      });
      expect(updateAlertLastKnownStatus).toHaveBeenCalledWith(7, "Low");
    });
  });
});

