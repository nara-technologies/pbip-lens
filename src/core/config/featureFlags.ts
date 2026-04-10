/**
 * PBIP Lens - Feature Flags
 * 
 * Registro central del estado de cada feature/vista de la extensión.
 * Para cambiar el estado de una feature, solo modifica este archivo.
 * 
 * Estados:
 *  - 'prod':    Siempre visible. Sin badge. Core estable de la extensión.
 *  - 'preview': Visible en producción y dev. Badge "✦ preview". Feature madura pero en validación.
 *  - 'dev':     Solo visible al ejecutar con F5 (debug). Badge "⚙ dev". No incluida en .vsix.
 */

export type FeatureStatus = 'prod' | 'preview' | 'dev';

export interface FeatureDefinition {
    /** ID único de la feature. Debe coincidir con el viewId en package.json. */
    id: string;
    /** Nombre base de la feature (sin badges). */
    displayName: string;
    /** Estado de la feature. Controla visibilidad y badging. */
    status: FeatureStatus;
    /** Descripción interna para documentación. */
    description?: string;
}

export const FEATURES: FeatureDefinition[] = [
    {
        id: 'pbipLensMeasuresView',
        displayName: 'Medidas y Dependencias',
        status: 'prod',
        description: 'Vista principal de árbol de medidas con análisis de dependencias DAX.'
    },
    {
        id: 'pbipLensTablesView',
        displayName: 'Tablas y Columnas',
        status: 'prod',
        description: 'Exploración de tablas, columnas y sus propiedades en el modelo semántico.'
    },
    {
        id: 'pbipLensQueriesView',
        displayName: 'Consultas Power Query',
        status: 'preview',
        description: 'Visualización de particiones M y expresiones del modelo, agrupadas por queryGroup.'
    },
    {
        id: 'pbipLensRelationshipsView',
        displayName: 'Relaciones del Modelo',
        status: 'dev',
        description: 'Visualización del grafo de relaciones entre tablas del modelo semántico.'
    },
];

/** Helpers para consultas rápidas en runtime. */
export const FeatureFlags = {
    getAll: () => FEATURES,
    getByStatus: (status: FeatureStatus) => FEATURES.filter(f => f.status === status),
    isEnabled: (id: string, isDev: boolean): boolean => {
        const feature = FEATURES.find(f => f.id === id);
        if (!feature) { return false; }
        if (feature.status === 'prod' || feature.status === 'preview') { return true; }
        if (feature.status === 'dev') { return isDev; }
        return false;
    }
};
