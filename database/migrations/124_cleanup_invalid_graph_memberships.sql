-- Clean up invalid graph memberships that don't match the 10 predefined graph types
DELETE FROM memory_graph_memberships
WHERE graph_type NOT IN (
  'problem', 'solution', 'market', 'risk', 'fit',
  'business', 'spec', 'distribution', 'marketing', 'manufacturing'
);
