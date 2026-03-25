export const PROVINCES = [
  'Western', 'Central', 'Southern', 'Northern', 'Eastern',
  'North Western', 'North Central', 'Uva', 'Sabaragamuwa'
];

export const DISTRICTS: Record<string, string[]> = {
  'Western': ['Colombo', 'Gampaha', 'Kalutara'],
  'Central': ['Kandy', 'Matale', 'Nuwara Eliya'],
  'Southern': ['Galle', 'Matara', 'Hambantota'],
  'Northern': ['Jaffna', 'Kilinochchi', 'Mannar', 'Mullaitivu', 'Vavuniya'],
  'Eastern': ['Ampara', 'Batticaloa', 'Trincomalee'],
  'North Western': ['Kurunegala', 'Puttalam'],
  'North Central': ['Anuradhapura', 'Polonnaruwa'],
  'Uva': ['Badulla', 'Monaragala'],
  'Sabaragamuwa': ['Kegalle', 'Ratnapura'],
};

export const GRAMA_NILADHARI_DIVISIONS: Record<string, Array<{code: string; name: string}>> = {
  'Colombo': [
    { code: 'GN-COL-001', name: 'Colombo Fort' },
    { code: 'GN-COL-002', name: 'Slave Island' },
    { code: 'GN-COL-003', name: 'Kotahena' },
    { code: 'GN-COL-004', name: 'Kochchikade' },
    { code: 'GN-COL-005', name: 'Mattakkuliya' },
    { code: 'GN-COL-006', name: 'Modara' },
    { code: 'GN-COL-007', name: 'Grandpass' },
    { code: 'GN-COL-008', name: 'Maradana' },
    { code: 'GN-COL-009', name: 'Borella' },
    { code: 'GN-COL-010', name: 'Cinnamon Gardens' },
    { code: 'GN-COL-011', name: 'Thurstan' },
    { code: 'GN-COL-012', name: 'Dematagoda' },
    { code: 'GN-COL-013', name: 'Narahenpita' },
    { code: 'GN-COL-014', name: 'Kirulapana' },
    { code: 'GN-COL-015', name: 'Wellawatte' },
    { code: 'GN-COL-016', name: 'Pamankada' },
    { code: 'GN-COL-017', name: 'Dehiwela' },
    { code: 'GN-COL-018', name: 'Mount Lavinia' },
  ],
  'Gampaha': [
    { code: 'GN-GAM-001', name: 'Gampaha Town' },
    { code: 'GN-GAM-002', name: 'Negombo' },
    { code: 'GN-GAM-003', name: 'Kandana' },
    { code: 'GN-GAM-004', name: 'Ja-Ela' },
    { code: 'GN-GAM-005', name: 'Peliyagoda' },
    { code: 'GN-GAM-006', name: 'Wattala' },
    { code: 'GN-GAM-007', name: 'Kelaniya' },
  ],
  'Kandy': [
    { code: 'GN-KAN-001', name: 'Kandy City' },
    { code: 'GN-KAN-002', name: 'Peradeniya' },
    { code: 'GN-KAN-003', name: 'Katugastota' },
    { code: 'GN-KAN-004', name: 'Kundasale' },
  ],
};

export const getGNDivisions = (district: string) => {
  return GRAMA_NILADHARI_DIVISIONS[district] || [];
};
