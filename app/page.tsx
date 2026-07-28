'use client';

import { ChamuyoCheckApp } from './ChamuyoCheckApp';

const IS_LEASING_SITE = process.env.NEXT_PUBLIC_SITE_MODE === 'leasing';

export default function Page() {
  return <ChamuyoCheckApp leasingPage={IS_LEASING_SITE} />;
}
