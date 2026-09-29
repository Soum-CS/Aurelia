export default function Loading() {
  return (
    <div className="container-x pt-16">
      <div className="mx-auto max-w-xl space-y-4 text-center">
        <div className="skeleton mx-auto h-4 w-32" />
        <div className="skeleton mx-auto h-12 w-full" />
        <div className="skeleton mx-auto h-4 w-3/4" />
      </div>
      <div className="skeleton mt-10 h-28 w-full rounded-3xl" />
      <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="card overflow-hidden p-0">
            <div className="skeleton aspect-[16/10] rounded-none" />
            <div className="space-y-3 p-5">
              <div className="skeleton h-3 w-24" />
              <div className="skeleton h-6 w-2/3" />
              <div className="skeleton h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
