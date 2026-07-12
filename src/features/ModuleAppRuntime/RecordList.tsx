import { memo } from 'react';

const RecordList = memo(() => {
  return <div data-testid="module-app-record-list" />;
});

RecordList.displayName = 'RecordList';

export default RecordList;
