import {requireChatGPTUser} from '../chatgpt-auth';import StudioShell from './shell';
export const dynamic='force-dynamic';
export default async function Studio(){await requireChatGPTUser('/studio');return <StudioShell/>;}
