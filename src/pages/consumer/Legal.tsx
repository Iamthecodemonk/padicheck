import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { PageHeader } from '../../components/consumer/PageHeader';
import { RichText } from '../../components/RichText';
import { usePlatform } from '../../contexts/PlatformContext';
import { formatDate } from '../../utils/checks';

export function Legal() {
  const { slug } = useParams<{slug: string;}>();
  const { getDoc } = usePlatform();
  const doc = slug ? getDoc(slug) : undefined;
  const live = doc && doc.kind !== 'copy' && doc.version > 0;

  return (
    <>
      <PageHeader title={live ? doc.title : 'Not found'} back="/account" />
      <article className="mx-auto w-full max-w-3xl px-4 pb-12 lg:px-10">
        {live ?
        <>
            <p className="text-sm text-muted">
              Version {doc.version} · Updated {formatDate(doc.updatedAt)}
            </p>
            <RichText text={doc.body} className="mt-6" />
          </> :

        <div className="py-16 text-center">
            <p className="font-semibold text-ink">This page isn’t available</p>
            <Link to="/account" className="mt-4 inline-flex h-12 items-center rounded-2xl bg-brand px-6 font-semibold text-white">
              Back to Account
            </Link>
          </div>
        }
      </article>
    </>);

}