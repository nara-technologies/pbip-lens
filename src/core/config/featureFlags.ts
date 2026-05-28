export type FeatureStatus = 'prod' | 'preview' | 'dev';

export interface FeatureDefinition {
    id: string;
    displayName: string;
    status: FeatureStatus;
    description?: string;
}

export const FEATURES: FeatureDefinition[] = [
    {
        id: 'pbipLensMeasuresView',
        displayName: 'Measures and Dependencies',
        status: 'prod',
        description: 'Main measures tree view with DAX dependency analysis.',
    },
    {
        id: 'pbipLensTablesView',
        displayName: 'Tables and Columns',
        status: 'prod',
        description: 'Exploration of tables, columns and their properties in the semantic model.',
    },
    {
        id: 'pbipLensQueriesView',
        displayName: 'Power Query Queries',
        status: 'preview',
        description:
            'Visualization of M partitions and model expressions, grouped by queryGroup.',
    },
    {
        id: 'pbipLensRelationshipsView',
        displayName: 'Model Relationships',
        status: 'dev',
        description: 'Visualization of the relationship graph between tables in the semantic model.',
    },
];

export const FeatureFlags = {
    getAll: () => FEATURES,
    getByStatus: (status: FeatureStatus) => FEATURES.filter((f) => f.status === status),
    isEnabled: (id: string, isDev: boolean): boolean => {
        const feature = FEATURES.find((f) => f.id === id);
        if (!feature) {
            return false;
        }
        if (feature.status === 'prod' || feature.status === 'preview') {
            return true;
        }
        if (feature.status === 'dev') {
            return isDev;
        }
        return false;
    },
};
