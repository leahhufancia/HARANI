import WorkspaceLayout from './WorkspaceLayout';

export default function BuyerLayout({ publicBrowse = false }) {
  return <WorkspaceLayout role="buyer" publicBrowse={publicBrowse} />;
}
