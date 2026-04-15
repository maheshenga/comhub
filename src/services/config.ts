import { BRANDING_NAME } from '@lobechat/business-const';
import { downloadFile, exportJSONFile } from '@lobechat/utils/client';
import dayjs from 'dayjs';

import { type ImportPgDataStructure } from '@/types/export';

import { exportService } from './export';

/**
 * Get brand name at runtime from the serverConfig store.
 * Falls back to compile-time BRANDING_NAME if store not initialized.
 */
const getRuntimeBrandName = (): string => {
  try {
    const store = window.global_serverConfigStore;
    if (store) {
      return store.getState().serverConfig.siteConfig?.brand_name || BRANDING_NAME;
    }
  } catch {
    // SSR or store not ready
  }
  return BRANDING_NAME;
};

class ConfigService {
  exportAll = async () => {
    const { data, url, schemaHash } = await exportService.exportData();
    const brandName = getRuntimeBrandName();
    const filename = `${dayjs().format('YYYY-MM-DD-hh-mm')}_${brandName}-data.json`;

    // if url exists, means export data from server and upload the data to S3
    // just need to download the file
    if (url) {
      await downloadFile(url, filename);
      return;
    }

    const result: ImportPgDataStructure = { data, mode: 'postgres', schemaHash };

    exportJSONFile(result, filename);
  };
}

export const configService = new ConfigService();
