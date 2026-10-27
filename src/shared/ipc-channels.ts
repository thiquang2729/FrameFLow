export const IPC_CHANNELS = {
  // Project
  PROJECT_LIST: 'project:list',
  PROJECT_GET: 'project:get',
  PROJECT_CREATE: 'project:create',
  PROJECT_DELETE: 'project:delete',
  PROJECT_STATS: 'project:stats',
  SELECT_DIRECTORY: 'dialog:select-directory',
  SELECT_VIDEO_FILE: 'dialog:select-video-file',
  SELECT_MEDIA_FILES: 'dialog:select-media-files',

  // Version
  VERSION_LIST: 'version:list',
  VERSION_CREATE: 'version:create',

  // Review & Comments
  COMMENT_LIST: 'comment:list',
  COMMENT_CREATE: 'comment:create',
  COMMENT_UPDATE_STATUS: 'comment:update-status',
  COMMENT_DELETE: 'comment:delete',

  // Source assets
  SOURCE_LIST: 'source:list',
  SOURCE_IMPORT: 'source:import',
  SOURCE_SCAN_DIRECTORY: 'source:scan-directory',

  // Revision Package
  PACKAGE_CREATE: 'package:create',
  PACKAGE_PREVIEW: 'package:preview',
  PACKAGE_OPEN_FOLDER: 'package:open-folder'
} as const
