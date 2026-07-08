import { AvatarController } from './controller';
import { mountPanelAvatar } from './panel-3d';

const win = window as unknown as {
  AutopilotAvatar3d: typeof mountPanelAvatar;
  AutopilotAvatarController: typeof AvatarController;
};
win.AutopilotAvatar3d = mountPanelAvatar;
win.AutopilotAvatarController = AvatarController;

export { mountPanelAvatar, AvatarController };
