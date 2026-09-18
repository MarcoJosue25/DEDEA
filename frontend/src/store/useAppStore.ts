import { create } from 'zustand';

interface AppState {
  uuid: string;
  inicializarUsuario: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Inicialización inmediata al cargar el store, antes de cualquier render
  uuid: (() => {
    let storedUuid = localStorage.getItem('dedea_user_uuid');
    if (!storedUuid) {
      storedUuid = crypto.randomUUID();
      localStorage.setItem('dedea_user_uuid', storedUuid);
    }
    return storedUuid;
  })(),

  // Respaldo idempotente: si por algún motivo el uuid del store quedara vacío
  // (nunca debería pasar, ya se inicializa arriba), esto lo repara sin generar
  // uno nuevo si localStorage ya tenía uno guardado.
  inicializarUsuario: () => {
    let storedUuid = localStorage.getItem('dedea_user_uuid');
    if (!storedUuid) {
      storedUuid = crypto.randomUUID();
      localStorage.setItem('dedea_user_uuid', storedUuid);
    }
    set({ uuid: storedUuid });
  },
}));