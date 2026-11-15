"use client";
import { createContext, useContext } from "react";
import type { WidgetId } from "@/config/default-layout";
export type WidgetCommand = "default-size" | "expand" | "duplicate" | "remove";
export const WidgetContext = createContext<{ id: string; type: WidgetId; command: (command: WidgetCommand) => void } | null>(null);
export const useWidgetContext = () => useContext(WidgetContext);
