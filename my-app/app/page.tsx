"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "@iconify/react";
import { 
  ComposedChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  CartesianGrid, 
  Line,
  BarChart,
  Cell
} from "recharts";

// --- CONFIGURACIÓN ESP32 ---
const ESP32_URL = ""; 

interface Alarma {
  id: number;
  hora: string;
  minuto: string;
  activa: boolean;
  tipo: "entrada" | "recreo" | "fin_recreo" | "salida"; // Añadido fin_recreo
}

export default function TimbreDarkDashboard() {
  const [alarmas, setAlarmas] = useState<Alarma[]>([]);
  const [nuevoTipo, setNuevoTipo] = useState<"entrada" | "recreo" | "fin_recreo" | "salida">("recreo");
  const [nuevaHoraCompleta, setNuevaHoraCompleta] = useState("08:00");

  // --- PROCESAMIENTO DE DATOS PARA RECHARTS ---
  const ordenarAlarmasCronologicamente = () => {
    return [...alarmas].sort((a, b) => {
      const minA = parseInt(a.hora) * 60 + parseInt(a.minuto);
      const minB = parseInt(b.hora) * 60 + parseInt(b.minuto);
      return minA - minB;
    });
  };

  // Datos para Gráfico 1: Línea de tiempo cronológica por jerarquía
  const chartData = ordenarAlarmasCronologicamente().map((al) => {
    // Escala jerárquica actualizada a 4 niveles
    const jerarquiaNumerica = 
      al.tipo === "entrada" ? 4 : 
      al.tipo === "recreo" ? 3 : 
      al.tipo === "fin_recreo" ? 2 : 1;

    return {
      id: al.id,
      Tiempo: `${al.hora.padStart(2, "0")}:${al.minuto.padStart(2, "0")}`,
      Tipo: al.tipo === "fin_recreo" ? "FIN RECREO" : al.tipo.toUpperCase(),
      "Nivel Jerárquico": jerarquiaNumerica,
      color: 
        al.tipo === "entrada" ? "#10b981" : 
        al.tipo === "recreo" ? "#f59e0b" : 
        al.tipo === "fin_recreo" ? "#f97316" : "#3b82f6",
    };
  });

  // Datos para Gráfico Extra: Contador y volumen por tipo de bloque
  const tiposDistribucionData = [
    { name: "Entradas", cantidad: alarmas.filter(a => a.tipo === "entrada").length, color: "#10b981" },
    { name: "Recreos", cantidad: alarmas.filter(a => a.tipo === "recreo").length, color: "#f59e0b" },
    { name: "Fin Recreos", cantidad: alarmas.filter(a => a.tipo === "fin_recreo").length, color: "#f97316" },
    { name: "Salidas", cantidad: alarmas.filter(a => a.tipo === "salida").length, color: "#3b82f6" },
  ];

  // --- ACCIONES API ESP32 ---
  const handleCrearAlarmaEspecial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (alarmas.length >= 30) {
      alert("Límite de 30 alarmas alcanzado.");
      return;
    }

    const [hora, minuto] = nuevaHoraCompleta.split(":");
    const nuevaAlarma: Alarma = {
      id: Date.now(),
      hora,
      minuto,
      activa: true,
      tipo: nuevoTipo,
    };
    
    const listaActualizada = [...alarmas, nuevaAlarma];
    setAlarmas(listaActualizada);

    try {
      await fetch(`${ESP32_URL}/add`, { method: "GET", mode: "no-cors" });
      await enviarSincronizacionAlHardware(listaActualizada);
    } catch (e) {
      console.error("Error con ESP32", e);
    }
  };

  const handleDelete = async (index: number) => {
    const nuevasAlarmas = alarmas.filter((_, i) => i !== index);
    setAlarmas(nuevasAlarmas);

    try {
      await fetch(`${ESP32_URL}/delete?id=${index}`, { method: "GET", mode: "no-cors" });
    } catch (e) { console.error("Error al borrar", e); }
  };

  const enviarSincronizacionAlHardware = async (listaDeAlarmas: Alarma[]) => {
    const formData = new URLSearchParams();
    listaDeAlarmas.forEach((alarma, i) => {
      formData.append(`t${i}`, `${alarma.hora.padStart(2, '0')}:${alarma.minuto.padStart(2, '0')}`);
      if (alarma.activa) formData.append(`a${i}`, "on");
    });

    await fetch(`${ESP32_URL}/save`, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData.toString(),
    });
  };

  const handleSaveExplicit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await enviarSincronizacionAlHardware(alarmas);
      alert("¡Hardware Sincronizado!");
    } catch (error) { console.error(error); }
  };

  const handleEmergency = async (tipo: "emergency" | "emergencyOff") => {
    try {
      await fetch(`${ESP32_URL}/${tipo}`, { method: "GET", mode: "no-cors" });
    } catch (error) { console.error(error); }
  };

  const updateAlarma = (index: number, campo: keyof Alarma, valor: string | boolean) => {
    const nuevas = [...alarmas];
    if (campo === "hora" || campo === "minuto") {
      const timeParts = (valor as string).split(":");
      nuevas[index].hora = timeParts[0];
      nuevas[index].minuto = timeParts[1];
    } else {
      nuevas[index] = { ...nuevas[index], [campo]: valor } as any;
    }
    setAlarmas(nuevas);
  };

  // Helpers estéticos para iconos y colores
  const getTipoMeta = (tipo: "entrada" | "recreo" | "fin_recreo" | "salida") => {
    switch (tipo) {
      case "entrada": return { icon: "mdi:door-open", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" };
      case "recreo": return { icon: "mdi:coffee", color: "text-amber-400 bg-amber-500/10 border-amber-500/20" };
      case "fin_recreo": return { icon: "mdi:bell-off", color: "text-orange-400 bg-orange-500/10 border-orange-500/20" };
      case "salida": return { icon: "mdi:logout", color: "text-blue-400 bg-blue-500/10 border-blue-500/20" };
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 font-sans p-4 md:p-10 flex flex-col items-center justify-center selection:bg-emerald-500 selection:text-slate-950">
      
      {/* Contenedor Responsivo del Dashboard */}
      <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
        
        {/* COLUMNA IZQUIERDA: Configuración y Formulario */}
        <div className="bg-slate-900 rounded-[24px] border border-slate-800 overflow-hidden shadow-2xl flex flex-col justify-between">
          <div>
            {/* Cabecera */}
            <div className="bg-slate-950 p-6 text-center border-b border-slate-800 flex items-center justify-between px-8">
              <h1 className="m-0 text-xl tracking-tighter font-black flex items-center gap-2">
                <Icon icon="mdi:bell-ring" className="text-emerald-500 text-2xl" /> SITAE <span className="text-emerald-500">XIDMET</span>
              </h1>
              <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold bg-slate-900 px-3 py-1.5 rounded-full border border-slate-800">
                {alarmas.length} / 30 Alarmas
              </div>
            </div>

            {/* Formulario Rápido con Iconos */}
            <div className="p-5 bg-slate-950/30 border-b border-slate-800/60">
              <p className="text-[11px] uppercase text-slate-400 font-bold tracking-wider mb-3 flex items-center gap-1.5">
                <Icon icon="mdi:plus-circle-outline" className="text-emerald-400 text-sm" /> Seleccionar Horario y tipo.
              </p>
              
              <form onSubmit={handleCrearAlarmaEspecial} className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="relative flex items-center">
                    <Icon icon="mdi:clock-outline" className="absolute left-3 text-slate-400 text-lg" />
                    <input
                      type="time"
                      value={nuevaHoraCompleta}
                      onChange={(e) => setNuevaHoraCompleta(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 pl-10 pr-3 py-2 rounded-lg text-white font-bold outline-none text-sm focus:border-emerald-500 transition"
                      required
                    />
                  </div>
                  <div className="relative flex items-center">
                    <select
                      value={nuevoTipo}
                      onChange={(e) => setNuevoTipo(e.target.value as any)}
                      className="w-full bg-slate-900 border border-slate-800 p-2 pl-3 rounded-lg text-xs font-bold outline-none text-slate-300 focus:border-emerald-500 transition cursor-pointer appearance-none"
                    >
                      <option value="entrada">Entrada</option>
                      <option value="recreo">Recreo</option>
                      <option value="fin_recreo">Fin de Recreo</option>
                      <option value="salida">Salida</option>
                    </select>
                    <Icon icon={getTipoMeta(nuevoTipo).icon} className="absolute right-3 text-slate-400 pointer-events-none" />
                  </div>
                </div>
                <button
                  type="submit"
                  className="w-full p-2.5 rounded-lg font-black uppercase text-[10px] bg-slate-800 border border-slate-700 text-emerald-400 tracking-wider flex items-center justify-center gap-1.5 hover:bg-slate-700 transition"
                >
                  <Icon icon="mdi:file-upload-outline" className="text-sm" /> Añadir nuevas alarmas.
                </button>
              </form>
            </div>

            {/* Listado de Alarmas */}
            <form onSubmit={handleSaveExplicit} className="p-5">
              <div className="max-h-[240px] overflow-y-auto pr-2 space-y-1 custom-scrollbar">
                <AnimatePresence initial={false}>
                  {alarmas.map((alarma, i) => {
                    const meta = getTipoMeta(alarma.tipo);
                    return (
                      <motion.div
                        key={alarma.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className="flex items-center justify-between py-2 border-b border-slate-800/50 gap-2"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-slate-600 font-mono text-xs font-bold w-6">#{String(i + 1).padStart(2, "0")}</span>
                          <span className={`text-[9px] uppercase px-2 py-0.5 rounded border font-extrabold tracking-wide flex items-center gap-1 ${meta.color}`}>
                            <Icon icon={meta.icon} /> {alarma.tipo === "fin_recreo" ? "fin recreo" : alarma.tipo}
                          </span>
                        </div>
                        
                        <input
                          type="time"
                          value={`${alarma.hora.padStart(2, '0')}:${alarma.minuto.padStart(2, '0')}`}
                          onChange={(e) => updateAlarma(i, "hora", e.target.value)}
                          className="bg-transparent border-none text-white text-sm font-bold outline-none accent-emerald-500 font-mono"
                        />
                        
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={alarma.activa}
                            onChange={(e) => updateAlarma(i, "activa", e.target.checked)}
                            className="scale-110 accent-emerald-500 cursor-pointer"
                          />
                          <button
                            type="button"
                            onClick={() => handleDelete(i)}
                            className="text-red-400 p-1 rounded hover:bg-red-500/10 transition"
                          >
                            <Icon icon="mdi:trash-can-outline" className="text-sm" />
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
                {alarmas.length === 0 && (
                  <p className="text-center text-slate-600 text-xs py-6 font-medium">No hay alertas mapeadas.</p>
                )}
              </div>

              <button
                type="submit"
                className="block w-full p-3.5 rounded-xl font-black uppercase transition-all text-center text-[10px] tracking-wide bg-emerald-500 text-slate-950 mt-4 hover:bg-emerald-400 flex items-center justify-center gap-1"
              >
                <Icon icon="mdi:sync" className="text-sm" /> Sincronizar Cambios de Bloque
              </button>
            </form>
          </div>

          {/* Controles de Pánico Manual */}
          <footer className="p-5 bg-slate-950 flex gap-2 border-t border-slate-800/40">
            <button
              onClick={() => handleEmergency("emergency")}
              className="flex-1 p-3 rounded-xl font-black uppercase text-[10px] tracking-wide bg-transparent border border-red-500 text-red-500 flex items-center justify-center gap-1.5 hover:bg-red-500/10 transition"
            >
              <Icon icon="mdi:alert-outline" className="text-sm" /> Forzar Encendido
            </button>
            <button
              onClick={() => handleEmergency("emergencyOff")}
              className="flex-1 p-3 rounded-xl font-black uppercase text-[10px] tracking-wide bg-slate-800 text-slate-200 flex items-center justify-center gap-1.5 hover:bg-slate-700 transition"
            >
              <Icon icon="mdi:power" className="text-sm" /> Cortar Timbre
            </button>
          </footer>
        </div>

        {/* COLUMNA DERECHA: Análisis Gráfico Avanzado */}
        <div className="bg-slate-900 rounded-[24px] border border-slate-800 p-6 shadow-2xl flex flex-col justify-between gap-6">
          
          {/* PRIMER GRÁFICO: Línea de tiempo jerárquica */}
          <div>
            <h2 className="text-md font-black tracking-tight mb-1 flex items-center gap-1.5">
              <Icon icon="mdi:timeline-text-outline" className="text-blue-400 text-xl" /> Cantidad de alarmas del dia.
            </h2>
            <p className="text-[11px] text-slate-500 mb-3">
              Distribución de alarmas siguiendo este orden (Entrada &gt; Recreo &gt; Fin Recreo &gt; Salida).
            </p>

            <div className="h-44 w-full bg-slate-950/40 p-2 rounded-xl border border-slate-800/60">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis dataKey="Tiempo" stroke="#64748b" fontSize={10} tickLine={false} />
                    <YAxis 
                      domain={[0, 5]} 
                      ticks={[1, 2, 3, 4]} 
                      stroke="#64748b" 
                      fontSize={9}
                      tickFormatter={(v) => v === 4 ? "ENT" : v === 3 ? "REC" : v === 2 ? "F.REC" : v === 1 ? "SAL" : ""}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#020617", borderColor: "#1e293b", borderRadius: "8px" }}
                      labelStyle={{ color: "#94a3b8", fontWeight: "bold", fontSize: "11px" }}
                      itemStyle={{ color: "#f8fafc", fontSize: "11px" }}
                    />
                    <Bar dataKey="Nivel Jerárquico" radius={[4, 4, 0, 0]} maxBarSize={20}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                    <Line type="monotone" dataKey="Nivel Jerárquico" stroke="#475569" strokeWidth={1.5} dot={{ r: 3 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-slate-600 font-medium">
                  Aún no hay una alarma para hace el grafico.
                </div>
              )}
            </div>
          </div>

          {/* NUEVO SEGUNDO GRÁFICO (EXTRA): Densidad y volumen por categoría */}
          <div className="border-t border-slate-800/60 pt-4">
            <h2 className="text-md font-black tracking-tight mb-1 flex items-center gap-1.5">
              <Icon icon="mdi:chart-bar" className="text-orange-400 text-xl" /> Cantidad de categorias totales de alarmas (Entrada,Recreo,etc)
            </h2>
            <p className="text-[11px] text-slate-500 mb-3">
              Mapeo cuantitativo de eventos registrados en la memoria intermedia.
            </p>

            <div className="h-36 w-full bg-slate-950/40 p-2 rounded-xl border border-slate-800/60">
              {alarmas.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={tiposDistribucionData} margin={{ top: 10, right: 10, left: -30, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis dataKey="name" stroke="#64748b" fontSize={9} tickLine={false} />
                    <YAxis stroke="#64748b" fontSize={9} allowDecimals={false} />
                    <Tooltip
                      cursor={{ fill: 'transparent' }}
                      contentStyle={{ backgroundColor: "#020617", borderColor: "#1e293b", borderRadius: "8px" }}
                      itemStyle={{ color: "#f8fafc", fontSize: "11px" }}
                    />
                    <Bar dataKey="cantidad" radius={[4, 4, 0, 0]} maxBarSize={25}>
                      {tiposDistribucionData.map((entry, index) => (
                        <Cell key={`cell-extra-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-slate-600 font-medium">
                  Sin registros cargados para calcular la cantidad de alarmas.
                </div>
              )}
            </div>
          </div>

          {/* Mini Referencia Visual */}
          <div className="grid grid-cols-4 gap-1.5 text-center text-[8px] font-bold uppercase tracking-wider">
            <div className="bg-emerald-500/10 text-emerald-400 p-1.5 rounded-lg border border-emerald-500/20 flex items-center justify-center gap-1">
              <Icon icon="mdi:door-open" /> ENT
            </div>
            <div className="bg-amber-500/10 text-amber-400 p-1.5 rounded-lg border border-amber-500/20 flex items-center justify-center gap-1">
              <Icon icon="mdi:coffee" /> REC
            </div>
            <div className="bg-orange-500/10 text-orange-400 p-1.5 rounded-lg border border-orange-500/20 flex items-center justify-center gap-1">
              <Icon icon="mdi:bell-off" /> F.REC
            </div>
            <div className="bg-blue-500/10 text-blue-400 p-1.5 rounded-lg border border-blue-500/20 flex items-center justify-center gap-1">
              <Icon icon="mdi:logout" /> SAL
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}