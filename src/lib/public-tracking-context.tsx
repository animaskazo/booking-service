import React, { createContext, useContext, useState } from 'react';

interface AppointmentData {
  id: string;
  short_id: string;
  status: string;
  paid: boolean;
  amount: number | null;
  service_id: string;
  start_time: string;
  end_time: string;
  flow_commerce_order?: string | null;
  flow_token?: string | null;
}

interface TicketData {
  id: string;
  status: string;
  budget: number;
  findings: string;
  ready_for_pickup: boolean;
}

interface TrackingContextValue {
  appointment: AppointmentData | null;
  ticket: TicketData | null;
  setTrackingData: (data: { appointment: AppointmentData; ticket: TicketData | null }) => void;
}

const TrackingContext = createContext<TrackingContextValue | undefined>(undefined);

export const PublicTrackingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [appointment, setAppointment] = useState<AppointmentData | null>(null);
  const [ticket, setTicket] = useState<TicketData | null>(null);

  const setTrackingData = (data: { appointment: AppointmentData; ticket: TicketData | null }) => {
    setAppointment(data.appointment);
    setTicket(data.ticket);
  };

  return (
    <TrackingContext.Provider value={{ appointment, ticket, setTrackingData }}>
      {children}
    </TrackingContext.Provider>
  );
};

export const usePublicTracking = (): TrackingContextValue => {
  const ctx = useContext(TrackingContext);
  if (!ctx) {
    throw new Error('usePublicTracking must be used within PublicTrackingProvider');
  }
  return ctx;
};
