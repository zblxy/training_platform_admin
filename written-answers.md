1. Since the service uses rolling update while the database switches to new column and drop deprecated column at the same deployment. Thus it will cause an error, after the database migration finished, the old application service will still try to access the droped column, and cause the error. Since the system also support rollback, similar issue will also appear for new service instances trying to access new column data.

    The safe sequence of the deployment for database and application:
   - database migration, add new column users.full_name, while keep the old column users.display_name still in table, then migrate the users.display_name to users.full_name
   - deploy the application service
   - after all instances updated, check database transaction log(binlog) and migrate the data in old column into new column during the period of deployment
   - after the new service goes steady and effective, create a new database migration to drop the old column if needed

2. set the ttl to 5 sec doesn't help beacuse during the 5 seconds, the stale value could still active in the system and cause trouble. The optimized read and write path to prevent this is to add another redis key as a lock for the certificate. Like below:

    > Read Path:
    - check if cache exist, if exist, return cache.
    - if cache not exist, use setnx with expire(e.g. 10 seconds) to get the certificate lock key(e.g. cert_aaaa_lock)
    - if successfully aquired the certificate lock, read data from database, write to cache, release the certificate lock key and return data with success
    - if retried in a loop and still cannot get the certificate lock key after the lock expiration time, return failure.

    > Write/revoke Path:
    - use setnx with expire(e.g. 10 seconds) to get the certificate lock key(e.g. cert_aaaa_lock)
    - if successfully aquired the certificate lock, update database(revoke certificate), delete the cache key, release the certificate lock key and return success
    - if retried in a loop and still cannot get the certificate lock key after the lock expiration time, return failure.

3. chain of failure:
    > when B's latency is 20ms
    - traffic to A: 1000 request/second
    - traffic A can handle: 1000 ms/ 20 ms/request * 50 workers = 2500 request/second

    Traffic volume A can handle is greater than traffic comming to A.

    > when B's latency increased to 2s
    - traffic to A: 1000 request/second
    - traffic B can handle, 1/2 = 0.5 request/second
    - since A calling B expiration time is 100ms < 2s, thus A always returns failure after 3*100ms = 300ms
    - traffic A can handle: 1000 ms / 300 ms/request * 50 workers = 166 request/second

    Thus A cannot handle 1000 request/second under this situation, and the requests will aggregate and occupied all the process resources of A, then caused whole service stop responding.

    Redesign:
    Split the worker pool, sicne normally it just need 1000 request/second / 1000 ms/ 20ms = 20 workers. We can design the /report endpoint occupied worker with a min = 20workers and max = 30 workers for example. Thus we can still have at least 20 workers to handle requests to other endpoints and do not hang the whole system.
    Another thing is we can optimize the retry mechanism using exponential backoff retry to reduce the traffic to B service if B service is unhealthy.
    The /report should return http 503 error code if B service is unhealthy.
