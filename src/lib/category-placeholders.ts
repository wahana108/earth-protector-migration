const CATEGORY_PLACEHOLDER: Record<string, string> = {
  tree_planting:         '/images/placeholder/tree_planting.svg',
  ocean_cleanup:         '/images/placeholder/ocean_cleanup.svg',
  wildlife_protection:   '/images/placeholder/wildlife.svg',
  ecosystem_restoration: '/images/placeholder/ecosystem.svg',
  renewable_energy:      '/images/placeholder/energy.svg',
  carbon_reduction:      '/images/placeholder/carbon.svg',
  lingkungan:            '/images/placeholder/lingkungan.svg',
  energi:                '/images/placeholder/energi.svg',
  sosial:                '/images/placeholder/sosial.svg',
  pendidikan:            '/images/placeholder/pendidikan.svg',
  kesehatan:             '/images/placeholder/kesehatan.svg',
  lainnya:               '/images/placeholder/default.svg',
};

export function getPlaceholder(kategori?: string): string {
  return CATEGORY_PLACEHOLDER[kategori ?? ''] ?? CATEGORY_PLACEHOLDER['lainnya'];
}
