export type LinkStatus = 'aktif' | 'tidak_aktif';

export async function checkLinkBukti(url: string): Promise<LinkStatus> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    await fetch(url, { mode: 'no-cors', signal: controller.signal });
    clearTimeout(timer);
    return 'aktif';
  } catch {
    return 'tidak_aktif';
  }
}
