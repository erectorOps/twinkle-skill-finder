/* clean */
import { deleteAsync } from 'del'; //データ削除用
import { distBase } from './_config.mjs';

export const clean = () => {
    return deleteAsync([distBase + '/**'], { force: true });
}